"use server";

import { revalidatePath } from "next/cache";
import * as accountsService from "@/lib/services/accounting/accounts";
import { requirePermission } from "@/lib/auth/session";
import { friendlyError, flattenZodError, type FormActionResult } from "@/lib/actions/utils";
import { z } from "zod";

const createAccountSchema = z.object({
  code: z.string().min(4, "Code must be at least 4 characters").max(10),
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
  description: z.string().optional(),
  openingBalance: z.coerce.number().min(0, "Opening balance cannot be negative"),
});

export async function createAccountAction(values: any): Promise<FormActionResult> {
  await requirePermission("accounting:manage");
  const parsed = createAccountSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }

  try {
    const account = await accountsService.createAccount({
      code: parsed.data.code,
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description,
      openingBalancePaise: Math.round(parsed.data.openingBalance * 100),
    });
    revalidatePath("/accounts");
    return { success: true, id: account.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function toggleAccountAction(id: string, isActive: boolean) {
  await requirePermission("accounting:manage");
  try {
    await accountsService.updateAccount(id, { isActive });
    revalidatePath("/accounts");
    return { success: true, message: `Account status updated` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
