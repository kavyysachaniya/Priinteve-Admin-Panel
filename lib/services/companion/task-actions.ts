import type { SessionUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import { startProjectTimer, stopActiveTimerForUser } from "@/lib/services/projects";
import { getTaskDetail, toggleTaskStatus } from "@/lib/services/tasks";
import { invalidateBriefingCache } from "@/lib/services/companion/briefing";

// Actions the desktop app can take on a task from its bubble. Each one re-checks that the
// device's user may see the task, and reuses the panel's own services so every business rule
// (timer ownership, one running timer per person, client limits) still applies.

export type CompanionTaskAction = "complete" | "start-timer" | "stop-timer";

export interface CompanionTaskResult {
  message: string;
  /** Name of the project whose timer was stopped to make room for the new one. */
  autoStopped?: string;
}

export async function runCompanionTaskAction(
  user: SessionUser,
  action: CompanionTaskAction,
  taskId: string,
): Promise<CompanionTaskResult> {
  try {
    if (action === "stop-timer") {
      if (!roleHasPermission(user.role, "projects:timer")) throw new Error("You can't track time.");
      await stopActiveTimerForUser(user.id);
      return { message: "Timer stopped." };
    }

    // Scoped lookup: null when this user can't see the task.
    const task = await getTaskDetail(taskId, user);
    if (!task) throw new Error("That task could not be found.");

    if (action === "complete") {
      if (!roleHasPermission(user.role, "tasks:edit")) throw new Error("You can't change tasks.");
      if (task.status !== "COMPLETED") await toggleTaskStatus(task.id, user);
      return { message: "Marked as done." };
    }

    // start-timer
    if (!roleHasPermission(user.role, "projects:timer")) throw new Error("You can't track time.");
    if (!task.projectId) throw new Error("This task has no project, so there's nothing to track time against.");
    if (task.status === "COMPLETED" || task.status === "CANCELLED") throw new Error("This task is already closed.");
    const entry = await startProjectTimer(task.projectId, user.id, task.title, task.id, { autoStopPrevious: true });
    return {
      message: entry.autoStoppedProjectName
        ? `Timer started. Your timer on "${entry.autoStoppedProjectName}" was stopped.`
        : "Timer started.",
      autoStopped: entry.autoStoppedProjectName ?? undefined,
    };
  } finally {
    // The next briefing should reflect what just changed.
    invalidateBriefingCache(user.id);
  }
}
