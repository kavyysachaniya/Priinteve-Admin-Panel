"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as customerService from "@/lib/services/customers";
import { customerFormSchema, type CustomerFormValues } from "@/lib/validations/customer";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";

export type { FormActionResult };

export async function createCustomerAction(values: CustomerFormValues): Promise<FormActionResult> {
  const session = await requirePermission("customers:create");
  const parsed = customerFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const customer = await customerService.createCustomer(parsed.data, session.id);
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    return { success: true, id: customer.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateCustomerAction(id: string, values: CustomerFormValues): Promise<FormActionResult> {
  const session = await requirePermission("customers:edit");
  const parsed = customerFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await customerService.updateCustomer(id, parsed.data, session.id);
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteCustomerAction(id: string) {
  await requirePermission("customers:delete");
  try {
    await customerService.deleteCustomer(id);
    revalidatePath("/customers");
    return { success: true as const, message: "Customer deleted successfully" };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}

export async function deleteCustomerAndRedirectAction(id: string) {
  await requirePermission("customers:delete");
  await customerService.deleteCustomer(id);
  revalidatePath("/customers");
  redirect("/customers");
}
