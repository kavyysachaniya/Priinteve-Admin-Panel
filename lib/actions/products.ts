"use server";

import { revalidatePath } from "next/cache";
import * as productService from "@/lib/services/products";
import { productFormSchema, type ProductFormValues } from "@/lib/validations/product";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";

export type { FormActionResult };

export async function createProductAction(values: ProductFormValues): Promise<FormActionResult> {
  await requirePermission("products:create");
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const product = await productService.createProduct(parsed.data);
    revalidatePath("/products");
    return { success: true, id: product.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateProductAction(id: string, values: ProductFormValues): Promise<FormActionResult> {
  await requirePermission("products:edit");
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await productService.updateProduct(id, parsed.data);
    revalidatePath("/products");
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteProductAction(id: string) {
  await requirePermission("products:delete");
  try {
    await productService.deleteProduct(id);
    revalidatePath("/products");
    return { success: true as const, message: "Product deleted successfully" };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}
