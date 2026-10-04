"use server";

import { revalidatePath } from "next/cache";
import * as projectService from "@/lib/services/projects";
import {
  projectFormSchema,
  startTimerSchema,
  timeEntryUpdateSchema,
  type ProjectFormValues,
  type TimeEntryUpdateValues,
} from "@/lib/validations/project";
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

export async function assignEmployeesAction(projectId: string, employeeIds: string[]) {
  const user = await requirePermission("users:manage"); // Admin only
  try {
    await projectService.assignEmployeesToProject(projectId, employeeIds, user);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, message: "Team assignments updated successfully." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function startProjectTimerAction(
  projectId: string,
  taskDescription: string = "Working on project",
  taskId?: string | null
) {
  const user = await requirePermission("projects:timer");
  const parsed = startTimerSchema.safeParse({ taskDescription, taskId });
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || "Task description is required (min 3 characters).",
    };
  }

  try {
    const entry = await projectService.startProjectTimer(
      projectId,
      user.id,
      parsed.data.taskDescription,
      parsed.data.taskId,
      { autoStopPrevious: true }
    );
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    const autoStoppedMsg = entry.autoStoppedProjectName
      ? ` (Previous timer on "${entry.autoStoppedProjectName}" was stopped)`
      : "";

    return {
      success: true,
      entry,
      message: `Timer started.${autoStoppedMsg}`,
    };
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

export async function stopProjectTimerAction(projectId: string, taskDescription?: string) {
  const user = await requirePermission("projects:timer");
  try {
    const res = await projectService.stopProjectTimer(projectId, user.id, taskDescription);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true, message: "Timer stopped successfully.", elapsedSeconds: res.elapsedSeconds };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function stopActiveTimerAction(taskDescription?: string) {
  const user = await requirePermission("projects:timer");
  try {
    const res = await projectService.stopActiveTimerForUser(user.id, taskDescription);
    revalidatePath("/projects");
    return { success: true, message: "Active timer stopped.", elapsedSeconds: res.elapsedSeconds };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateTimeEntryAction(
  id: string,
  projectId: string,
  values: TimeEntryUpdateValues
) {
  const user = await requirePermission("projects:timer");
  const parsed = timeEntryUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || "Invalid time entry data.",
    };
  }

  try {
    await projectService.updateTimeEntry(id, parsed.data, user);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, message: "Time entry updated successfully." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteTimeEntryAction(id: string, projectId: string) {
  const user = await requirePermission("projects:timer");
  try {
    await projectService.deleteTimeEntry(id, user);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, message: "Time entry deleted successfully." };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
