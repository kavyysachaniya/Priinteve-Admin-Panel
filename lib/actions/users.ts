"use server";

import { revalidatePath } from "next/cache";
import * as userService from "@/lib/services/users";
import { userFormSchema, changePasswordSchema } from "@/lib/validations/user";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission, requireAuth } from "@/lib/auth/session";

export type { FormActionResult };

export async function createUserAction(values: unknown): Promise<FormActionResult> {
  await requirePermission("users:manage");
  const session = await requireAuth();

  const parsed = userFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }

  const { password, ...data } = parsed.data;
  if (!password) {
    return { success: false, message: "Password is required for new users." };
  }

  try {
    const user = await userService.createUser({
      ...data,
      password,
      createdById: session.id,
    });
    revalidatePath("/users");
    return { success: true, id: user.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateUserAction(id: string, values: unknown): Promise<FormActionResult> {
  await requirePermission("users:manage");

  const parsed = userFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }

  try {
    const { password, ...data } = parsed.data;
    await userService.updateUser(id, { ...data, password: password || undefined });
    revalidatePath("/users");
    revalidatePath(`/users/${id}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function changePasswordAction(id: string, values: unknown): Promise<FormActionResult> {
  await requirePermission("users:manage");

  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }

  try {
    await userService.updateUser(id, { password: parsed.data.password });
    revalidatePath(`/users/${id}`);
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deactivateUserAction(id: string): Promise<FormActionResult> {
  await requirePermission("users:manage");
  const session = await requireAuth();

  if (session.id === id) {
    return { success: false, message: "You cannot deactivate your own account." };
  }

  try {
    await userService.deactivateUser(id);
    revalidatePath("/users");
    revalidatePath(`/users/${id}`);
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function activateUserAction(id: string): Promise<FormActionResult> {
  await requirePermission("users:manage");
  try {
    await userService.activateUser(id);
    revalidatePath("/users");
    revalidatePath(`/users/${id}`);
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
