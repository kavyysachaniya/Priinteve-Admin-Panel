"use server";

import { revalidatePath } from "next/cache";
import * as vendorService from "@/lib/services/vendors";
import { vendorFormSchema, type VendorFormValues } from "@/lib/validations/vendor";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";

export async function createVendorAction(values: VendorFormValues): Promise<FormActionResult> {
  const parsed = vendorFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const vendor = await vendorService.createVendor(parsed.data);
    revalidatePath("/vendors");
    revalidatePath("/expenses");
    return { success: true, id: vendor.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateVendorAction(id: string, values: VendorFormValues): Promise<FormActionResult> {
  const parsed = vendorFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await vendorService.updateVendor(id, parsed.data);
    revalidatePath("/vendors");
    revalidatePath(`/vendors/${id}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteVendorAction(id: string) {
  try {
    await vendorService.deleteVendor(id);
    revalidatePath("/vendors");
    return { success: true, message: "Vendor deleted" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

