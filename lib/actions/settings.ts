"use server";

import { revalidatePath } from "next/cache";
import { updateCompanySettings } from "@/lib/services/settings";
import { updateSequencePrefix } from "@/lib/services/numbering";
import { companySettingsFormSchema, numberingFormSchema, type CompanySettingsFormValues, type NumberingFormValues } from "@/lib/validations/settings";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";

export type { FormActionResult };

export async function updateCompanySettingsAction(values: CompanySettingsFormValues): Promise<FormActionResult> {
  const parsed = companySettingsFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const data = parsed.data;
    await updateCompanySettings({
      ...data,
      tagline: data.tagline || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      gstin: data.gstin || null,
      pan: data.pan || null,
      bankName: data.bankName || null,
      bankAccountName: data.bankAccountName || null,
      bankAccountNumber: data.bankAccountNumber || null,
      bankIfsc: data.bankIfsc || null,
      bankBranch: data.bankBranch || null,
      quotationTerms: data.quotationTerms || null,
      invoiceTerms: data.invoiceTerms || null,
    });
    revalidatePath("/settings");
    revalidatePath("/quotations");
    revalidatePath("/invoices");
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateNumberingAction(values: NumberingFormValues): Promise<FormActionResult> {
  const parsed = numberingFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await Promise.all([
      updateSequencePrefix("quotation", parsed.data.quotationPrefix),
      updateSequencePrefix("invoice", parsed.data.invoicePrefix),
    ]);
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
