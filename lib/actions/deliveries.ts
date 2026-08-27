"use server";

import { revalidatePath } from "next/cache";
import * as deliveryService from "@/lib/services/deliveries";
import { friendlyError } from "@/lib/actions/utils";
import type { DeliveryStatus } from "@prisma/client";

export async function updateDeliveryStatusAction(id: string, status: DeliveryStatus, notes?: string) {
  try {
    const delivery = await deliveryService.updateDeliveryStatus(id, status, notes);
    revalidatePath("/deliveries");
    revalidatePath(`/deliveries/${id}`);
    revalidatePath("/orders");
    revalidatePath("/planner");
    return { success: true, message: `Delivery status updated to ${status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

