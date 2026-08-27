"use server";

import { revalidatePath } from "next/cache";
import * as orderService from "@/lib/services/orders";
import { orderFormSchema, type OrderFormValues } from "@/lib/validations/order";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";
import type { OrderStatus } from "@prisma/client";

export async function createOrderAction(values: OrderFormValues): Promise<FormActionResult> {
  const session = await requirePermission("orders:create");
  const parsed = orderFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const order = await orderService.createOrder(parsed.data, session.id);
    revalidatePath("/orders");
    revalidatePath("/production");
    revalidatePath("/planner");
    return { success: true, id: order.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateOrderAction(id: string, values: OrderFormValues): Promise<FormActionResult> {
  const session = await requirePermission("orders:edit");
  const parsed = orderFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await orderService.updateOrder(id, parsed.data, session.id);
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
    revalidatePath("/production");
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateOrderStatusAction(id: string, status: OrderStatus) {
  const session = await requirePermission("orders:update_status");
  try {
    await orderService.updateOrderStatus(id, status, session.id);
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
    revalidatePath("/production");
    return { success: true, message: `Order status updated to ${status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteOrderAction(id: string) {
  await requirePermission("orders:delete");
  try {
    await orderService.deleteOrder(id);
    revalidatePath("/orders");
    revalidatePath("/production");
    return { success: true, message: "Order deleted" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function convertQuotationToOrderAction(quotationId: string) {
  const session = await requirePermission("orders:create");
  try {
    const order = await orderService.convertQuotationToOrder(quotationId, session.id);
    revalidatePath("/orders");
    revalidatePath("/production");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotationId}`);
    return { success: true, orderId: order.id, message: `Order ${order.number} created from quotation` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
