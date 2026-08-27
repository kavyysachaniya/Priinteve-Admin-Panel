import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import type { DeliveryStatus, DeliveryMethod, Prisma } from "@prisma/client";

const PAGE_SIZE = 15;

export interface ListDeliveriesParams {
  q?: string;
  status?: DeliveryStatus;
  page?: number;
}

export async function listDeliveries(params: ListDeliveriesParams) {
  const page = Math.max(1, params.page ?? 1);
  const where: Prisma.DeliveryWhereInput = {
    ...(params.status ? { status: params.status } : {}),
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
}

export async function getDeliveryDetail(id: string) {
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
