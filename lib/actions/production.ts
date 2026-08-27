"use server";

import { revalidatePath } from "next/cache";
import * as productionService from "@/lib/services/production";
import { friendlyError } from "@/lib/actions/utils";
import type { ProductionStatus } from "@prisma/client";

export async function updateProductionJobStatusAction(
  id: string,
  status: ProductionStatus,
  notes?: string
) {
  try {
    const job = await productionService.updateProductionJobStatus(id, status, notes);
    revalidatePath("/production");
    revalidatePath(`/production/${id}`);
    revalidatePath("/orders");
    revalidatePath("/planner");
    return { success: true, message: `Production stage updated to ${status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

