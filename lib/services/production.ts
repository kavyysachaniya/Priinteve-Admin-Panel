import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import { generateProductionNumber } from "@/lib/services/numbering";
import type { ProductionJobFormValues } from "@/lib/validations/production";
import type { Prisma, ProductionStatus, OrderPriority } from "@prisma/client";

const PAGE_SIZE = 15;

const ALL_PRODUCTION_STATUSES: ProductionStatus[] = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "COMPLETED",
  "ON_HOLD",
];

export interface ListProductionJobsParams {
  q?: string;
  stage?: ProductionStatus;
  priority?: OrderPriority;
  assignedToId?: string;
  orderId?: string;
  page?: number;
}

export async function listProductionJobs(params: ListProductionJobsParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where: Prisma.ProductionJobWhereInput = {
      ...(params.stage ? { status: params.stage } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
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
  } catch (err) {
    console.error("Error in listProductionJobs:", err);
    return { jobs: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function getProductionJobDetail(id: string) {
  try {
    const job = await prisma.productionJob.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, number: true, notes: true, customer: { select: { name: true } } } },
        assignedTo: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
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
  } catch (err) {
    console.error("Error in getProductionJobDetail:", err);
    return null;
  }
}

export async function updateProductionJobStatus(
  id: string,
  status: ProductionStatus,
  notes?: string,
  userId?: string
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
        changedById: userId || null,
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
    userId,
  });

  return updated;
}

/**
 * Counts of production jobs per stage, for the summary tiles on the
 * production list page. Independent of any list pagination/filtering.
 */
export async function getProductionStageCounts(): Promise<Record<ProductionStatus, number>> {
  const counts = await prisma.productionJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const result = Object.fromEntries(ALL_PRODUCTION_STATUSES.map((s) => [s, 0])) as Record<
    ProductionStatus,
    number
  >;
  for (const c of counts) {
    result[c.status] = c._count._all;
  }
  return result;
}

/**
 * Create a production job from an existing order (optionally seeded from one
 * of the order's line items so item/product/quantity don't have to be
 * retyped). customerId is always derived from the order, never user-supplied.
 */
export async function createProductionJob(data: ProductionJobFormValues, userId?: string) {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    select: { id: true, customerId: true, number: true },
  });
  if (!order) throw new Error("Order not found.");

  const number = await generateProductionNumber();

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.productionJob.create({
      data: {
        number,
        orderId: order.id,
        customerId: order.customerId,
        productId: data.productId || null,
        itemName: data.itemName,
        quantity: data.quantity,
        assignedToId: data.assignedToId || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
        priority: data.priority as OrderPriority,
        internalNotes: data.internalNotes || null,
      },
    });

    await tx.productionJobHistory.create({
      data: {
        productionJobId: created.id,
        status: "PENDING",
        notes: "Job created",
        changedById: userId || null,
      },
    });

    return created;
  });

  await logActivity({
    type: "production.created",
    message: `Production job ${job.number} created from order ${order.number}`,
    entityType: "production",
    entityId: job.id,
    productionJobId: job.id,
    orderId: job.orderId,
    userId,
  });

  return job;
}
