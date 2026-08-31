import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import { generateDeliveryNumber } from "@/lib/services/numbering";
import type { DeliveryFormValues } from "@/lib/validations/delivery";
import type { DeliveryStatus, Prisma } from "@prisma/client";

const PAGE_SIZE = 15;

const ALL_DELIVERY_STATUSES: DeliveryStatus[] = [
  "PENDING",
  "SCHEDULED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RETURNED",
];

export interface ListDeliveriesParams {
  q?: string;
  status?: DeliveryStatus;
  assignedPerson?: string;
  deliveryDate?: string;
  page?: number;
}

export async function listDeliveries(params: ListDeliveriesParams) {
  try {
    const page = Math.max(1, params.page ?? 1);

    let deliveryDateFilter: Prisma.DeliveryWhereInput = {};
    if (params.deliveryDate) {
      const start = new Date(params.deliveryDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      deliveryDateFilter = { deliveryDate: { gte: start, lt: end } };
    }

    const where: Prisma.DeliveryWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.assignedPerson ? { assignedPerson: params.assignedPerson } : {}),
      ...deliveryDateFilter,
      ...(params.q
        ? {
            OR: [
              { number: { contains: params.q } },
              { trackingNumber: { contains: params.q } },
              { deliveryAddress: { contains: params.q } },
              { customer: { name: { contains: params.q } } },
            ],
          }
        : {}),
    };

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        orderBy: { deliveryDate: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          customer: { select: { id: true, name: true } },
          order: { select: { id: true, number: true } },
        },
      }),
      prisma.delivery.count({ where }),
    ]);

    return { deliveries, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listDeliveries:", err);
    return { deliveries: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function getDeliveryDetail(id: string) {
  try {
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        order: { select: { id: true, number: true, totalPaise: true } },
        history: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!delivery) return null;

    const activityLogs = await prisma.activityLog.findMany({
      where: { deliveryId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return { ...delivery, activityLogs };
  } catch (err) {
    console.error("Error in getDeliveryDetail:", err);
    return null;
  }
}

export async function updateDeliveryStatus(
  id: string,
  status: DeliveryStatus,
  notes?: string
) {
  const existing = await prisma.delivery.findUnique({ where: { id } });
  if (!existing) throw new Error("Delivery not found");

  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.delivery.update({
      where: { id },
      data: {
        status,
        ...(status === "DELIVERED" ? { actualDeliveryDate: new Date() } : {}),
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: id,
        status,
        notes: notes || null,
      },
    });

    if (status === "DELIVERED") {
      await tx.order.update({
        where: { id: d.orderId },
        data: { status: "DELIVERED" },
      });
    } else if (status === "OUT_FOR_DELIVERY") {
      await tx.order.update({
        where: { id: d.orderId },
        data: { status: "OUT_FOR_DELIVERY" },
      });
    }

    return d;
  });

  await logActivity({
    type: "delivery.status_changed",
    message: `Delivery ${updated.number} status changed to ${status}`,
    entityType: "delivery",
    entityId: updated.id,
    deliveryId: updated.id,
    customerId: updated.customerId,
    orderId: updated.orderId,
  });

  return updated;
}

/** Counts of deliveries per status, for the summary tiles on the list page. */
export async function getDeliveryStatusCounts(): Promise<Record<DeliveryStatus, number>> {
  const counts = await prisma.delivery.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const result = Object.fromEntries(ALL_DELIVERY_STATUSES.map((s) => [s, 0])) as Record<DeliveryStatus, number>;
  for (const c of counts) {
    result[c.status] = c._count._all;
  }
  return result;
}

/** Distinct, non-empty assignedPerson values currently on record — for the filter dropdown. */
export async function listAssignedPersons(): Promise<string[]> {
  const rows = await prisma.delivery.findMany({
    where: { assignedPerson: { not: null } },
    select: { assignedPerson: true },
    distinct: ["assignedPerson"],
    orderBy: { assignedPerson: "asc" },
  });
  return rows.map((r) => r.assignedPerson).filter((v): v is string => Boolean(v));
}

/**
 * Create a delivery from an order that doesn't already have one (1:1
 * relation). customerId is always derived from the order.
 */
export async function createDelivery(data: DeliveryFormValues) {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    select: { id: true, customerId: true, number: true, delivery: { select: { id: true } } },
  });
  if (!order) throw new Error("Order not found.");
  if (order.delivery) throw new Error("This order already has a delivery.");

  const number = await generateDeliveryNumber();

  const delivery = await prisma.$transaction(async (tx) => {
    const created = await tx.delivery.create({
      data: {
        number,
        orderId: order.id,
        customerId: order.customerId,
        deliveryAddress: data.deliveryAddress,
        contactNumber: data.contactNumber,
        deliveryDate: new Date(data.deliveryDate),
        deliveryMethod: data.deliveryMethod,
        trackingNumber: data.trackingNumber || null,
        assignedPerson: data.assignedPerson || null,
        notes: data.notes || null,
      },
    });

    await tx.deliveryStatusHistory.create({
      data: { deliveryId: created.id, status: "PENDING", notes: "Delivery created" },
    });

    return created;
  });

  await logActivity({
    type: "delivery.created",
    message: `Delivery ${delivery.number} created for order ${order.number}`,
    entityType: "delivery",
    entityId: delivery.id,
    deliveryId: delivery.id,
    customerId: delivery.customerId,
    orderId: delivery.orderId,
  });

  return delivery;
}
