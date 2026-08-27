import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import type { Prisma, ProductionStatus, OrderPriority } from "@prisma/client";

const PAGE_SIZE = 15;

export interface ListProductionJobsParams {
  q?: string;
  stage?: ProductionStatus;
  orderId?: string;
  page?: number;
}

export async function listProductionJobs(params: ListProductionJobsParams) {
  const page = Math.max(1, params.page ?? 1);
  const where: Prisma.ProductionJobWhereInput = {
    ...(params.stage ? { status: params.stage } : {}),
    ...(params.orderId ? { orderId: params.orderId } : {}),
    ...(params.q
      ? {
          OR: [
            { number: { contains: params.q } },
            { itemName: { contains: params.q } },
            { order: { number: { contains: params.q } } },
            { order: { customer: { name: { contains: params.q } } } },
          ],
        }
      : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.productionJob.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        order: { select: { id: true, number: true, customer: { select: { name: true } } } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.productionJob.count({ where }),
  ]);

  return { jobs, total, page, pageSize: PAGE_SIZE };
}

export async function getProductionJobDetail(id: string) {
  const job = await prisma.productionJob.findUnique({
    where: { id },
    include: {
      order: { select: { id: true, number: true, notes: true, customer: { select: { name: true } } } },
      assignedTo: { select: { id: true, name: true } },
      history: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!job) return null;

  const activityLogs = await prisma.activityLog.findMany({
    where: { productionJobId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return { ...job, activityLogs };
}

export async function updateProductionJobStatus(
  id: string,
  status: ProductionStatus,
  notes?: string
) {
  const job = await prisma.productionJob.findUnique({ where: { id } });
  if (!job) throw new Error("Production job not found");

  const updated = await prisma.$transaction(async (tx) => {
    const j = await tx.productionJob.update({
      where: { id },
      data: {
        status,
        ...(status === "COMPLETED" ? { actualCompletionDate: new Date() } : {}),
      },
    });

    await tx.productionJobHistory.create({
      data: {
        productionJobId: id,
        status,
        notes: notes || null,
      },
    });

    const allJobs = await tx.productionJob.findMany({ where: { orderId: j.orderId } });
    const allCompleted = allJobs.every((jobItem) => jobItem.status === "COMPLETED");

    if (allCompleted) {
      await tx.order.update({
        where: { id: j.orderId },
        data: { status: "READY" },
      });
    } else {
      await tx.order.update({
        where: { id: j.orderId },
        data: { status: "IN_PRODUCTION" },
      });
    }

    return j;
  });

  await logActivity({
    type: "production.status_changed",
    message: `Production job ${updated.number} stage changed to ${status}`,
    entityType: "production",
    entityId: updated.id,
    productionJobId: updated.id,
    orderId: updated.orderId,
  });

  return updated;
}
