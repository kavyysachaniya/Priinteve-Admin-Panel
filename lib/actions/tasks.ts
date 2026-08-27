"use server";

import { revalidatePath } from "next/cache";
import * as taskService from "@/lib/services/tasks";
import { taskFormSchema, type TaskFormValues } from "@/lib/validations/task";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";

export async function createTaskAction(values: TaskFormValues): Promise<FormActionResult> {
  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const task = await taskService.createTask(parsed.data);
    revalidatePath("/tasks");
    revalidatePath("/planner");
    return { success: true, id: task.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateTaskAction(id: string, values: TaskFormValues): Promise<FormActionResult> {
  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await taskService.updateTask(id, parsed.data);
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
    revalidatePath("/planner");
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function toggleTaskStatusAction(id: string) {
  try {
    const task = await taskService.toggleTaskStatus(id);
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
    revalidatePath("/planner");
    return { success: true, message: `Task status updated to ${task.status}` };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteTaskAction(id: string) {
  try {
    await taskService.deleteTask(id);
    revalidatePath("/tasks");
    revalidatePath("/planner");
    return { success: true, message: "Task deleted" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

