"use server";

import { revalidatePath } from "next/cache";
import * as expenseService from "@/lib/services/expenses";
import { expenseFormSchema, type ExpenseFormValues } from "@/lib/validations/expense";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";

export async function createExpenseAction(values: ExpenseFormValues): Promise<FormActionResult> {
  const parsed = expenseFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const expense = await expenseService.createExpense(parsed.data);
    revalidatePath("/expenses");
    revalidatePath("/finance");
    revalidatePath("/dashboard");
    return { success: true, id: expense.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateExpenseAction(id: string, values: ExpenseFormValues): Promise<FormActionResult> {
  const parsed = expenseFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await expenseService.updateExpense(id, parsed.data);
    revalidatePath("/expenses");
    revalidatePath(`/expenses/${id}`);
    revalidatePath("/finance");
    revalidatePath("/dashboard");
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteExpenseAction(id: string) {
  try {
    await expenseService.deleteExpense(id);
    revalidatePath("/expenses");
    revalidatePath("/finance");
    revalidatePath("/dashboard");
    return { success: true, message: "Expense deleted" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

