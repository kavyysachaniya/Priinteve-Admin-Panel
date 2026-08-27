"use server";

import { revalidatePath } from "next/cache";
import * as quotationService from "@/lib/services/quotations";
import { quotationFormSchema, type QuotationFormValues } from "@/lib/validations/quotation";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";
import type { QuotationStatus } from "@prisma/client";

export type { FormActionResult };

export async function createQuotationAction(values: QuotationFormValues): Promise<FormActionResult> {
  await requirePermission("quotations:create");
  const parsed = quotationFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const quotation = await quotationService.createQuotation(parsed.data);
    revalidatePath("/quotations");
    revalidatePath("/dashboard");
    return { success: true, id: quotation.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateQuotationAction(id: string, values: QuotationFormValues): Promise<FormActionResult> {
  await requirePermission("quotations:edit");
  const parsed = quotationFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await quotationService.updateQuotation(id, parsed.data);
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function changeQuotationStatusAction(id: string, status: QuotationStatus) {
  await requirePermission("quotations:edit");
  try {
    await quotationService.changeQuotationStatus(id, status);
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    revalidatePath("/dashboard");
    return { success: true as const, message: "Quotation status updated" };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}

export async function convertQuotationToInvoiceAction(id: string) {
  await requirePermission("quotations:convert");
  try {
    const invoice = await quotationService.convertQuotationToInvoice(id);
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    revalidatePath("/invoices");
    revalidatePath("/dashboard");
    return { success: true as const, invoiceId: invoice.id };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}

export async function duplicateQuotationAction(id: string) {
  await requirePermission("quotations:create");
  try {
    const quotation = await quotationService.duplicateQuotation(id);
    revalidatePath("/quotations");
    return { success: true as const, id: quotation.id };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}

export async function deleteQuotationAction(id: string) {
  await requirePermission("quotations:delete");
  try {
    await quotationService.deleteQuotation(id);
    revalidatePath("/quotations");
    return { success: true as const, message: "Quotation deleted" };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}
