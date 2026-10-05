"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import {
  accountNameSchema,
  accountPasswordSchema,
  type AccountNameValues,
  type AccountPasswordValues,
} from "@/lib/validations/account";
import { changeOwnPassword, updateOwnName } from "@/lib/services/account";

// "My account" is open to every role, so these use requireAuth() rather than a permission.
// The user id always comes from the session.

export async function updateAccountNameAction(values: AccountNameValues): Promise<FormActionResult> {
  const user = await requireAuth();
  const parsed = accountNameSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const name = await updateOwnName(user.id, parsed.data.name);
    revalidatePath("/", "layout");
    return { success: true, message: name };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function changeAccountPasswordAction(values: AccountPasswordValues): Promise<FormActionResult> {
  const user = await requireAuth();
  const parsed = accountPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await changeOwnPassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
