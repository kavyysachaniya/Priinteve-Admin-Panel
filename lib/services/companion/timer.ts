import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import { getVisibleProjectsQuery } from "@/lib/auth/projects";
import {
  getActiveSessionForUser,
  pauseProjectTimer,
  recordTimerHeartbeat,
  resumeProjectTimer,
  startProjectTimer,
  stopProjectTimer,
  type TimerOpOptions,
  type TimerStopReason,
} from "@/lib/services/projects";
import { createTask } from "@/lib/services/tasks";
import { taskFormDefaults } from "@/lib/validations/task";
import type { CompanionTimerOp } from "@/lib/validations/companion-timer";
import { invalidateBriefingCache } from "@/lib/services/companion/briefing";

// The desktop app's timer. Every start/pause/resume/stop is an "op" with a client-made id that
// the app writes to a local journal before sending. Ops arrive here in journal order, possibly
// late (the PC was offline) and possibly twice (a retry after a lost response). The
// TimerOperation ledger makes a replay return the first result instead of acting again.

/** An op this close to the server clock was sent live; older ones were queued offline. */
const LIVE_SKEW_MS = 15_000;

export type CompanionOpStatus = "APPLIED" | "CONFLICT" | "REJECTED";

export interface CompanionOpResult {
  opId: string;
  status: CompanionOpStatus;
  message: string;
}

export type CompanionSession = NonNullable<Awaited<ReturnType<typeof getActiveSessionForUser>>>;

export interface CompanionTimerState {
  session: CompanionSession | null;
  /** Projects this person may track time on, with their open tasks, for the timer picker. */
  projects: Array<{
    id: string;
    name: string;
    code: string | null;
    tasks: Array<{ id: string; title: string; status: string }>;
  }>;
  canCreateTasks: boolean;
  serverTime: string;
}

export async function getCompanionTimerState(user: SessionUser): Promise<CompanionTimerState> {
  if (!roleHasPermission(user.role, "projects:timer")) {
    return { session: null, projects: [], canCreateTasks: false, serverTime: new Date().toISOString() };
  }

  // Read the session first so the app sees the previous heartbeat: a big gap means the PC was
  // off, asleep or the app had crashed while the timer ran (the interrupted-session check).
  const session = await getActiveSessionForUser(user.id);
  await recordTimerHeartbeat(user.id);

  const [projects] = await Promise.all([

    prisma.project.findMany({
      where: { AND: [getVisibleProjectsQuery(user), { status: { notIn: ["COMPLETED", "CANCELLED"] } }] },
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        name: true,
        code: true,
        tasks: {
          where: {
            status: { in: ["TODO", "IN_PROGRESS"] },
            // Admins see every open task; others the ones assigned to them or unassigned.
            ...(user.role === "ADMIN" ? {} : { OR: [{ assignedToId: user.id }, { assignedToId: null }] }),
          },
          orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
          take: 50,
          select: { id: true, title: true, status: true },
        },
      },
    }),
  ]);

  return {
    session,
    projects,
    canCreateTasks: roleHasPermission(user.role, "tasks:create"),
    serverTime: new Date().toISOString(),
  };
}

/** Applies ops in order. A rejected op doesn't stop the ones after it; each gets its own result. */
export async function applyCompanionTimerOps(user: SessionUser, ops: CompanionTimerOp[]) {
  const results: CompanionOpResult[] = [];
  try {
    for (const op of ops) {
      results.push(await applyOne(user, op));
    }
  } finally {
    invalidateBriefingCache(user.id);
  }
  return { results, state: await getCompanionTimerState(user) };
}

async function applyOne(user: SessionUser, op: CompanionTimerOp): Promise<CompanionOpResult> {
  const seen = await prisma.timerOperation.findUnique({ where: { opId: op.opId } });
  if (seen) {
    if (seen.userId !== user.id) {
      return { opId: op.opId, status: "REJECTED", message: "This operation belongs to another account." };
    }
    return seen.result as unknown as CompanionOpResult;
  }

  let result: CompanionOpResult;
  if (!roleHasPermission(user.role, "projects:timer")) {
    result = { opId: op.opId, status: "REJECTED", message: "You can't track time." };
  } else {
    try {
      result = await execute(user, op);
    } catch (err) {
      result = {
        opId: op.opId,
        status: "REJECTED",
        message: err instanceof Error ? err.message : "The server couldn't apply this timer action.",
      };
    }
  }

  try {
    await prisma.timerOperation.create({
      data: {
        opId: op.opId,
        userId: user.id,
        type: op.type,
        occurredAt: new Date(op.occurredAt),
        status: result.status,
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // The same op raced in from a second request: report what that one recorded.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await prisma.timerOperation.findUnique({ where: { opId: op.opId } });
      if (winner) return winner.result as unknown as CompanionOpResult;
    }
    throw err;
  }
  return result;
}

async function execute(user: SessionUser, op: CompanionTimerOp): Promise<CompanionOpResult> {
  const occurredAt = new Date(op.occurredAt);
  const delayed = Math.abs(Date.now() - occurredAt.getTime()) > LIVE_SKEW_MS;
  const opts: TimerOpOptions = {
    // A live op takes effect now (the PC clock may be wrong); a queued one at its recorded time.
    at: delayed ? occurredAt : undefined,
    source: delayed ? "DESKTOP_OFFLINE" : "DESKTOP",
  };
  const ok = (message: string): CompanionOpResult => ({ opId: op.opId, status: "APPLIED", message });
  const conflict = (message: string): CompanionOpResult => ({ opId: op.opId, status: "CONFLICT", message });

  const running = await prisma.projectTimeEntry.findFirst({
    where: { userId: user.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });

  switch (op.type) {
    case "START": {
      // Replayed after the segment was created but before the ledger row: nothing to redo.
      const existing = await prisma.projectTimeEntry.findUnique({ where: { clientOpId: op.opId } });
      if (existing) return ok("Timer started.");

      if (delayed && running && running.startedAt.getTime() > occurredAt.getTime()) {
        return conflict("A newer timer was started elsewhere while this PC was offline, so this start was not applied.");
      }

      let taskId = op.taskId ?? null;
      let title = op.description?.trim() || "";
      if (!taskId && op.newTaskTitle) {
        if (!roleHasPermission(user.role, "tasks:create")) throw new Error("You can't create tasks.");
        const task = await createTask(
          taskFormDefaults({
            title: op.newTaskTitle,
            projectId: op.projectId,
            assigneeId: user.id,
            assignedToId: user.id,
            status: "IN_PROGRESS",
          }),
          user
        );
        taskId = task.id;
        title = title || task.title;
      } else if (taskId && !title) {
        const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } });
        title = task?.title ?? "";
      }

      const entry = await startProjectTimer(op.projectId, user.id, title || "Working on project", taskId, {
        ...opts,
        autoStopPrevious: true,
        clientOpId: op.opId,
      });
      return ok(
        entry.autoStoppedProjectName
          ? `Timer started. Your timer on "${entry.autoStoppedProjectName}" was stopped.`
          : "Timer started."
      );
    }

    case "PAUSE": {
      if (!running) return ok("The timer was already paused or stopped.");
      if (op.entryId && running.id !== op.entryId) {
        return conflict("A different timer is running now, so this pause was not applied.");
      }
      await pauseProjectTimer(running.projectId, user.id, opts);
      return ok("Timer paused.");
    }

    case "RESUME": {
      await resumeProjectTimer(op.projectId, user.id, { ...opts, clientOpId: op.opId });
      return ok("Timer resumed.");
    }

    case "STOP": {
      const paused = running
        ? null
        : await prisma.projectTimeEntry.findFirst({
            where: { userId: user.id, status: "PAUSED" },
            orderBy: { startedAt: "desc" },
          });
      const open = running ?? paused;
      if (!open) return ok("The timer was already stopped.");

      // The op names the session it meant to stop; a newer session is left alone.
      if (op.sessionId && (open.sessionId ?? open.id) !== op.sessionId) {
        return ok("That session was already stopped; your current timer keeps running.");
      }

      const reason: TimerStopReason = op.stopReason ?? "USER";
      const at = reason === "RECOVERY" ? occurredAt : opts.at;
      const before = { ...open };
      const res = await stopProjectTimer(open.projectId, user.id, undefined, { ...opts, at, stopReason: reason });

      if (reason === "RECOVERY" && res.entryId) {
        const after = await prisma.projectTimeEntry.update({
          where: { id: res.entryId },
          data: { interrupted: true },
        });
        await prisma.timeEntryCorrection.create({
          data: {
            entryId: after.id,
            projectId: after.projectId,
            action: "RECOVERY",
            reason: op.note?.trim() || "Interrupted session stopped at the last confirmed activity",
            before: {
              startedAt: before.startedAt.toISOString(),
              endedAt: null,
              status: before.status,
              lastHeartbeatAt: before.lastHeartbeatAt?.toISOString() ?? null,
            },
            after: {
              startedAt: after.startedAt.toISOString(),
              endedAt: after.endedAt?.toISOString() ?? null,
              durationSeconds: after.durationSeconds,
              status: after.status,
            },
            changedById: user.id,
          },
        });
      }

      return ok(
        reason === "SHUTDOWN"
          ? "Timer stopped before shutdown."
          : reason === "RECOVERY"
            ? "Interrupted session closed at the last confirmed activity."
            : "Timer stopped."
      );
    }
  }
}
