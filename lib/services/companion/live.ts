import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { getActiveTimerForUser } from "@/lib/services/projects";

// Lightweight state the desktop bubble polls while it is open, so a timer started or a task
// completed in the panel shows up on the rows within seconds. It returns only the person's
// own running timer and the status of the task ids they ask about (and may see).

const MAX_IDS = 40;
const TASK_ID = /^[A-Za-z0-9_-]{1,40}$/;

const idsSchema = z.array(z.string().regex(TASK_ID)).max(MAX_IDS);

/** Parses `?tasks=a,b,c`. Returns null for an invalid or oversized list. */
export function parseLiveIds(raw: string | null): string[] | null {
  if (!raw) return [];
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  const parsed = idsSchema.safeParse(ids);
  return parsed.success ? parsed.data : null;
}

export interface LiveState {
  timer: { taskId: string | null; projectName: string; taskTitle: string | null; startedAt: string } | null;
  /** Status per task id. Ids the person can't see are left out. */
  tasks: Record<string, "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED">;
}

export async function getLiveState(user: SessionUser, taskIds: string[]): Promise<LiveState> {
  const [timer, rows] = await Promise.all([
    getActiveTimerForUser(user.id),
    taskIds.length === 0
      ? Promise.resolve([])
      : prisma.task.findMany({
          where: {
            id: { in: taskIds },
            // Same visibility rule as the briefing's task list: admins see all, others their own.
            ...(user.role === "ADMIN"
              ? {}
              : { OR: [{ assignedToId: user.id }, { mentions: { some: { employeeId: user.id } } }] }),
          },
          select: { id: true, status: true },
        }),
  ]);

  return {
    timer: timer
      ? {
          taskId: timer.taskId,
          projectName: timer.projectName,
          taskTitle: timer.taskTitle,
          startedAt: new Date(timer.startedAt).toISOString(),
        }
      : null,
    tasks: Object.fromEntries(rows.map((r) => [r.id, r.status])),
  };
}
