"use server";

import { revalidatePath } from "next/cache";
import * as invoiceService from "@/lib/services/invoices";
import { invoiceFormSchema, type InvoiceFormValues } from "@/lib/validations/invoice";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";

export type { FormActionResult };

export async function createInvoiceAction(values: InvoiceFormValues): Promise<FormActionResult> {
  await requirePermission("invoices:create");
  const parsed = invoiceFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const invoice = await invoiceService.createInvoice(parsed.data);
    revalidatePath("/invoices");
    revalidatePath("/dashboard");
    return { success: true, id: invoice.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateInvoiceAction(id: string, values: InvoiceFormValues): Promise<FormActionResult> {
  await requirePermission("invoices:edit");
  const parsed = invoiceFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await invoiceService.updateInvoice(id, parsed.data);
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function markInvoiceSentAction(id: string) {
  const user = await requirePermission("invoices:edit");
  try {
    await invoiceService.markInvoiceSent(id, user.id);
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    revalidatePath("/finance");
    return { success: true as const, message: "Invoice marked as sent" };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}

export async function cancelInvoiceAction(id: string) {
  const user = await requirePermission("invoices:edit");
  try {
    await invoiceService.cancelInvoice(id, user.id);
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    return { success: true as const, message: "Invoice cancelled" };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}
