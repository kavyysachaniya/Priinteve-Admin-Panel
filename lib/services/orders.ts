import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { generateOrderNumber, issueDocumentNumber } from "@/lib/services/numbering";
import { logActivity } from "@/lib/services/activity";
import type { OrderFormValues } from "@/lib/validations/order";
import type { Prisma, OrderStatus, OrderPriority } from "@prisma/client";

const PAGE_SIZE = 15;

export interface ListOrdersParams {
  q?: string;
  status?: OrderStatus;
  customerId?: string;
  page?: number;
}

export async function listOrders(params: ListOrdersParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where: Prisma.OrderWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.q
        ? {
            OR: [
              { number: { contains: params.q } },
              { notes: { contains: params.q } },
              { customer: { name: { contains: params.q } } },
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          customer: { select: { id: true, name: true } },
          productionJobs: { select: { id: true, status: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listOrders:", err);
    return { orders: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function getOrderDetail(id: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true, gstin: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
        productionJobs: { orderBy: { createdAt: "asc" } },
        delivery: true,
        sourceQuotation: { select: { id: true, number: true } },
      },
    });
    if (!order) return null;

    const activityLogs = await prisma.activityLog.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return { ...order, activityLogs };
  } catch (err) {
    console.error("Error in getOrderDetail:", err);
    return null;
  }
}

export function orderToFormValues(order: any): OrderFormValues {
  return {
    customerId: order.customerId,
    title: order.notes ?? "",
    priority: order.priority,
    orderDate: order.orderDate ? new Date(order.orderDate).toISOString().slice(0, 10) : "",
    expectedCompletionDate: order.expectedCompletionDate ? new Date(order.expectedCompletionDate).toISOString().slice(0, 10) : "",
    items: order.items.map((i: any) => ({
      productId: i.productId ?? "",
      name: i.name,
      description: i.description ?? "",
      quantity: i.quantity,
      unitPricePaise: i.ratePaise,
      totalPaise: i.amountPaise,
    })),
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    taxablePaise: order.subtotalPaise - order.discountPaise,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    totalAmountPaise: order.totalPaise,
    notes: order.notes ?? "",
    quotationId: order.sourceQuotationId ?? "",
  };
}

export async function createOrder(data: OrderFormValues, userId?: string) {
  const number = await generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        number,
        customerId: data.customerId,
        priority: data.priority,
        orderDate: new Date(data.orderDate),
        expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
        subtotalPaise: data.subtotalPaise,
        discountPaise: data.discountPaise,
        taxPaise: Math.round((data.taxablePaise * 18) / 100),
        totalPaise: data.totalAmountPaise,
        notes: data.title || data.notes || null,
        sourceQuotationId: data.quotationId || null,
        items: {
          create: data.items.map((item, idx) => ({
            productId: item.productId || null,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity,
            ratePaise: item.unitPricePaise,
            amountPaise: item.totalPaise,
            sortOrder: idx,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of o.items) {
      const prodNum = await issueDocumentNumber(tx, "production");
      await tx.productionJob.create({
        data: {
          number: prodNum,
          orderId: o.id,
          customerId: o.customerId,
          productId: item.productId,
          itemName: item.name,
          quantity: item.quantity,
          priority: o.priority,
          status: "PENDING",
          expectedCompletionDate: o.expectedCompletionDate,
        },
      });
    }

    return o;
  }, TX_OPTIONS);

  await logActivity({
    type: "order.created",
    message: `Order ${order.number} created for ₹${(order.totalPaise / 100).toFixed(2)}`,
    entityType: "order",
    entityId: order.id,
    orderId: order.id,
    customerId: order.customerId,
    userId,
  });

  return order;
}

export async function convertQuotationToOrder(quotationId: string, userId?: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { items: true, convertedOrder: true },
  });
  if (!quotation) throw new Error("Quotation not found");
  if (quotation.status !== "ACCEPTED") {
    throw new Error("Only accepted quotations can be converted to an order");
  }
  if (quotation.convertedOrder) {
    throw new Error("This quotation has already been converted to an order");
  }

  return prisma.$transaction(async (tx) => {
    const number = await issueDocumentNumber(tx, "order");
    const order = await tx.order.create({
      data: {
        number,
        customerId: quotation.customerId,
        sourceQuotationId: quotation.id,
        orderDate: new Date(),
        expectedCompletionDate: quotation.validUntil,
        status: "CONFIRMED",
        priority: "MEDIUM",
        subtotalPaise: quotation.subtotalPaise,
        discountPaise: quotation.discountPaise,
        taxPaise: quotation.taxPaise,
        shippingPaise: quotation.shippingPaise,
        totalPaise: quotation.totalPaise,
        notes: quotation.notes,
        items: {
          create: quotation.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            ratePaise: item.ratePaise,
            discountPercent: item.discountPercent,
            gstRate: item.gstRate,
            amountPaise: item.amountPaise,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of order.items) {
      const prodNum = await issueDocumentNumber(tx, "production");
      await tx.productionJob.create({
        data: {
          number: prodNum,
          orderId: order.id,
          customerId: order.customerId,
          productId: item.productId,
          itemName: item.name,
          quantity: item.quantity,
          priority: order.priority,
          status: "PENDING",
          expectedCompletionDate: order.expectedCompletionDate,
        },
      });
    }

    await logActivity(
      {
        type: "order.created",
        message: `Order ${order.number} created from quotation ${quotation.number}`,
        entityType: "order",
        entityId: order.id,
        orderId: order.id,
        customerId: order.customerId,
        userId,
      },
      tx
    );

    return order;
  }, TX_OPTIONS);
}

export async function updateOrder(id: string, data: OrderFormValues, userId?: string) {
  const order = await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: id } });

    const updated = await tx.order.update({
      where: { id },
      data: {
        customerId: data.customerId,
        priority: data.priority,
        orderDate: new Date(data.orderDate),
        expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
        subtotalPaise: data.subtotalPaise,
        discountPaise: data.discountPaise,
        taxPaise: Math.round((data.taxablePaise * 18) / 100),
        totalPaise: data.totalAmountPaise,
        notes: data.title || data.notes || null,
        items: {
          create: data.items.map((item, idx) => ({
            productId: item.productId || null,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity,
            ratePaise: item.unitPricePaise,
            amountPaise: item.totalPaise,
            sortOrder: idx,
          })),
        },
      },
    });

    return updated;
  }, TX_OPTIONS);

  await logActivity({
    type: "order.updated",
    message: `Order ${order.number} updated`,
    entityType: "order",
    entityId: order.id,
    orderId: order.id,
    customerId: order.customerId,
    userId,
  });

  return order;
}

export async function updateOrderStatus(id: string, status: OrderStatus, userId?: string) {
  const updated = await prisma.order.update({
    where: { id },
    data: { status },
  });

  await logActivity({
    type: "order.status_changed",
    message: `Order ${updated.number} status updated to ${status}`,
    entityType: "order",
    entityId: updated.id,
    orderId: updated.id,
    customerId: updated.customerId,
    userId,
  });

  return updated;
}

export async function deleteOrder(id: string) {
  return prisma.order.delete({ where: { id } });
}

