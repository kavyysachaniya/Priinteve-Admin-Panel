"use server";

import { revalidatePath } from "next/cache";
import * as orderService from "@/lib/services/orders";
import { orderFormSchema, type OrderFormValues } from "@/lib/validations/order";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import type { OrderStatus } from "@prisma/client";

export async function createOrderAction(values: OrderFormValues): Promise<FormActionResult> {
  const parsed = orderFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const order = await orderService.createOrder(parsed.data);
    revalidatePath("/orders");
    revalidatePath("/production");
    revalidatePath("/planner");
    return { success: true, id: order.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateOrderAction(id: string, values: OrderFormValues): Promise<FormActionResult> {
  const parsed = orderFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await orderService.updateOrder(id, parsed.data);
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
    revalidatePath("/production");
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateOrderStatusAction(id: string, status: OrderStatus) {
  try {
    const order = await orderService.updateOrderStatus(id, status);
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
    revalidatePath("/production");
    return { success: true, message: `Order status updated to ${status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteOrderAction(id: string) {
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
  try {
    const order = await orderService.convertQuotationToOrder(quotationId);
    revalidatePath("/orders");
    revalidatePath("/production");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotationId}`);
    return { success: true, orderId: order.id, message: `Order ${order.number} created from quotation` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

