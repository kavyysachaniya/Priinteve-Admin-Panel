"use server";

import { revalidatePath } from "next/cache";
import * as paymentService from "@/lib/services/payments";
import { paymentFormSchema, type PaymentFormValues } from "@/lib/validations/payment";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";

export type { FormActionResult };

export async function createPaymentAction(values: PaymentFormValues): Promise<FormActionResult> {
  await requirePermission("payments:record");
  const parsed = paymentFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const payment = await paymentService.createPayment(parsed.data);
    revalidatePath("/payments");
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${parsed.data.invoiceId}`);
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    return { success: true, id: payment.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deletePaymentAction(id: string) {
  await requirePermission("payments:delete");
  try {
    const payment = await paymentService.getPaymentDetail(id);
    await paymentService.deletePayment(id);
    revalidatePath("/payments");
    revalidatePath("/invoices");
    if (payment) revalidatePath(`/invoices/${payment.invoiceId}`);
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    return { success: true as const, message: "Payment deleted successfully" };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}
