"use server";

import { revalidatePath } from "next/cache";
import * as productionService from "@/lib/services/production";
import { productionJobFormSchema, type ProductionJobFormValues } from "@/lib/validations/production";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";
import type { ProductionStatus } from "@prisma/client";

export async function createProductionJobAction(values: ProductionJobFormValues): Promise<FormActionResult> {
  const session = await requirePermission("production:create");
  const parsed = productionJobFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const job = await productionService.createProductionJob(parsed.data, session.id);
    revalidatePath("/production");
    revalidatePath(`/orders/${parsed.data.orderId}`);
    revalidatePath("/planner");
    return { success: true, id: job.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateProductionJobStatusAction(
  id: string,
  status: ProductionStatus,
  notes?: string
) {
  const session = await requirePermission("production:update_assigned");
  try {
    await productionService.updateProductionJobStatus(id, status, notes, session.id);
    revalidatePath("/production");
    revalidatePath(`/production/${id}`);
    revalidatePath("/orders");
    revalidatePath("/planner");
    return { success: true, message: `Production stage updated to ${status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
