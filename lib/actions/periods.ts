"use server";

import { revalidatePath } from "next/cache";
import * as periodsService from "@/lib/services/accounting/periods";
import { requirePermission } from "@/lib/auth/session";
import { friendlyError, flattenZodError, type FormActionResult } from "@/lib/actions/utils";
import { z } from "zod";

const createPeriodSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export async function createAccountingPeriodAction(values: any): Promise<FormActionResult> {
  await requirePermission("accounting:manage");
  const parsed = createPeriodSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }

  try {
    const period = await periodsService.createAccountingPeriod(parsed.data);
    revalidatePath("/accounting/periods");
    return { success: true, id: period.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function togglePeriodStatusAction(id: string): Promise<FormActionResult> {
  await requirePermission("accounting:manage");
  try {
    const period = await periodsService.togglePeriodStatus(id);
    revalidatePath("/accounting/periods");
    return { success: true, id: period.id, message: `Period status toggled to ${period.status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
