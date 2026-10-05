import type { ItemAction } from "@/lib/services/companion/types";

/**
 * The state of a task row in the desktop bubble: which buttons it gets and whether the
 * person's running timer is on it. A running task offers Stop instead of Start (and the app
 * keeps this up to date through /api/companion/live).
 */
export function taskRowState(
  task: { id: string; project: unknown | null },
  runningTaskId: string | null,
): { running?: boolean; actions: ItemAction[] } {
  if (runningTaskId !== null && task.id === runningTaskId) return { running: true, actions: ["complete", "stop-timer"] };
  return { actions: task.project ? ["complete", "start-timer"] : ["complete"] };
}
