"use server";

import { revalidatePath } from "next/cache";
import * as deliveryService from "@/lib/services/deliveries";
import { deliveryFormSchema, type DeliveryFormValues } from "@/lib/validations/delivery";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";
import type { DeliveryStatus } from "@prisma/client";

export async function createDeliveryAction(values: DeliveryFormValues): Promise<FormActionResult> {
  await requirePermission("deliveries:create");
  const parsed = deliveryFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const delivery = await deliveryService.createDelivery(parsed.data);
    revalidatePath("/deliveries");
    revalidatePath(`/orders/${parsed.data.orderId}`);
    revalidatePath("/planner");
    return { success: true, id: delivery.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateDeliveryStatusAction(id: string, status: DeliveryStatus, notes?: string) {
  await requirePermission("deliveries:update_status");
  try {
    await deliveryService.updateDeliveryStatus(id, status, notes);
    revalidatePath("/deliveries");
    revalidatePath(`/deliveries/${id}`);
    revalidatePath("/orders");
    revalidatePath("/planner");
    return { success: true, message: `Delivery status updated to ${status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
