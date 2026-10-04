"use server";

import { revalidatePath } from "next/cache";
import * as taskService from "@/lib/services/tasks";
import { taskFormSchema, type TaskFormValues } from "@/lib/validations/task";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";

export async function createTaskAction(values: TaskFormValues): Promise<FormActionResult> {
  const user = await requirePermission("tasks:create");
  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const task = await taskService.createTask(parsed.data, user);
    revalidatePath("/tasks");
    revalidatePath("/planner");
    if (task.projectId) {
      revalidatePath(`/projects/${task.projectId}`);
    }
    return { success: true, id: task.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateTaskAction(id: string, values: TaskFormValues): Promise<FormActionResult> {
  const user = await requirePermission("tasks:edit");
  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const updated = await taskService.updateTask(id, parsed.data, user);
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
    revalidatePath("/planner");
    if (updated.projectId) {
      revalidatePath(`/projects/${updated.projectId}`);
    }
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function toggleTaskStatusAction(id: string) {
  const user = await requirePermission("tasks:edit");
  try {
    const task = await taskService.toggleTaskStatus(id, user);
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
    revalidatePath("/planner");
    if (task.projectId) {
      revalidatePath(`/projects/${task.projectId}`);
    }
    return { success: true, message: `Task status updated to ${task.status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteTaskAction(id: string) {
  const user = await requirePermission("tasks:delete");
  try {
    const task = await taskService.deleteTask(id, user);
    revalidatePath("/tasks");
    revalidatePath("/planner");
    if (task.projectId) {
      revalidatePath(`/projects/${task.projectId}`);
    }
    return { success: true, message: "Task deleted" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
