"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { taskCommentEditSchema, taskCommentSchema, type TaskCommentValues } from "@/lib/validations/task-comments";
import { addTaskComment, deleteTaskComment, updateTaskComment } from "@/lib/services/task-comments";

// Commenting needs only `tasks:view`: the service checks the user can actually see the task.
// Clients can discuss tasks in their own projects even though they can't edit team tasks.

export async function addTaskCommentAction(values: TaskCommentValues): Promise<FormActionResult> {
  const user = await requirePermission("tasks:view");
  const parsed = taskCommentSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid comment.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const id = await addTaskComment(user, parsed.data);
    revalidatePath(`/tasks/${parsed.data.taskId}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateTaskCommentAction(values: { commentId: string; body: string }): Promise<FormActionResult> {
  const user = await requirePermission("tasks:view");
  const parsed = taskCommentEditSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid comment." };
  try {
    const taskId = await updateTaskComment(user, parsed.data);
    revalidatePath(`/tasks/${taskId}`);
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteTaskCommentAction(commentId: string): Promise<FormActionResult> {
  const user = await requirePermission("tasks:view");
  const parsed = z.string().trim().min(1).max(40).safeParse(commentId);
  if (!parsed.success) return { success: false, message: "Invalid comment." };
  try {
    const taskId = await deleteTaskComment(user, parsed.data);
    revalidatePath(`/tasks/${taskId}`);
    return { success: true, message: "Comment deleted" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
