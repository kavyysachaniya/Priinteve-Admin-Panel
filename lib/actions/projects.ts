"use server";

import { revalidatePath } from "next/cache";
import * as projectService from "@/lib/services/projects";
import { projectFormSchema, type ProjectFormValues } from "@/lib/validations/project";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";

export async function createProjectAction(values: ProjectFormValues): Promise<FormActionResult> {
  const user = await requirePermission("projects:create");
  const parsed = projectFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }
  try {
    const project = await projectService.createProject(parsed.data, user.id);
    revalidatePath("/projects");
    return { success: true, id: project.id, message: "Project created successfully." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateProjectAction(id: string, values: ProjectFormValues): Promise<FormActionResult> {
  const user = await requirePermission("projects:edit");
  const parsed = projectFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }
  try {
    await projectService.updateProject(id, parsed.data, user.id);
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    revalidatePath(`/projects/${id}/edit`);
    return { success: true, id, message: "Project updated successfully." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteProjectAction(id: string): Promise<FormActionResult> {
  const user = await requirePermission("projects:delete");
  try {
    await projectService.deleteProject(id, user.id);
    revalidatePath("/projects");
    return { success: true, message: "Project deleted successfully." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function startProjectTimerAction(projectId: string, notes?: string) {
  const user = await requirePermission("projects:timer");
  try {
    const entry = await projectService.startProjectTimer(projectId, user.id, notes);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true, entry, message: "Timer started." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function pauseProjectTimerAction(projectId: string) {
  const user = await requirePermission("projects:timer");
  try {
    const entry = await projectService.pauseProjectTimer(projectId, user.id);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true, entry, message: "Timer paused." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function resumeProjectTimerAction(projectId: string) {
  const user = await requirePermission("projects:timer");
  try {
    const entry = await projectService.resumeProjectTimer(projectId, user.id);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true, entry, message: "Timer resumed." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function stopProjectTimerAction(projectId: string) {
  const user = await requirePermission("projects:timer");
  try {
    await projectService.stopProjectTimer(projectId, user.id);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true, message: "Timer stopped." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
