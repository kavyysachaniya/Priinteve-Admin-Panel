import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type EntityType =
  | "customer"
  | "quotation"
  | "invoice"
  | "payment"
  | "product"
  | "order"
  | "production"
  | "delivery"
  | "expense"
  | "vendor"
  | "task"
  | "note"
  | "calendar_event";

export type ActivityInput = {
  type: string;
  message: string;
  entityType: EntityType;
  entityId: string;
  customerId?: string | null;
  quotationId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  orderId?: string | null;
  productionJobId?: string | null;
  deliveryId?: string | null;
  expenseId?: string | null;
  vendorId?: string | null;
  taskId?: string | null;
  userId?: string | null;
};

/** Records a business event to the activity feed. Pass a transaction client to keep it atomic. */
export async function logActivity(
  input: ActivityInput,
  client: TxClient | Prisma.TransactionClient = prisma
) {
  const data = {
    type: input.type,
    message: input.message,
    entityType: input.entityType,
    entityId: input.entityId,
    customerId: input.customerId ?? null,
    quotationId: input.quotationId ?? null,
    invoiceId: input.invoiceId ?? null,
    paymentId: input.paymentId ?? null,
    orderId: input.orderId ?? null,
    productionJobId: input.productionJobId ?? null,
    deliveryId: input.deliveryId ?? null,
    expenseId: input.expenseId ?? null,
    vendorId: input.vendorId ?? null,
    taskId: input.taskId ?? null,
    userId: input.userId ?? null,
  };

  try {
    return await client.activityLog.create({ data });
  } catch (err) {
    // If transaction client was closed or expired, log using global prisma client safely
    try {
      return await prisma.activityLog.create({ data });
    } catch {
      return null;
    }
  }
}

/** Utility to retrieve activity feed for a given entity or customer */
export async function getActivityLogsForEntity(
  filter: {
    customerId?: string;
    orderId?: string;
    productionJobId?: string;
    deliveryId?: string;
    expenseId?: string;
    vendorId?: string;
    taskId?: string;
  },
  limit = 20
) {
  return prisma.activityLog.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
