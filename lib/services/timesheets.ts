import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, type SessionUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import {
  groupEntries,
  monthRange,
  resolveRange,
  secondsInRange,
  splitByDay,
  type DateRange,
  type EntryFilter,
  type GroupBy,
  type TimesheetEntry,
} from "@/lib/timesheet";
import type { TimesheetQuery } from "@/lib/validations/timesheet";

// Timesheets: who worked how long, per task, project, person or day, over any date range.
// Employees see only their own time; admins can look at anyone's. Clients have no access.
// All stopped time counts, whether or not it has been shared with a client.
//
// A range includes every entry that *overlaps* it, and counts only the part inside it: a
// session from 23:00 to 01:00 gives one hour to each day, and one crossing a month end is
// split between the months. Stored timestamps are never changed.

const MAX_ENTRIES = 5000;
/** The CSV export reads up to this many entries (a month for the whole team fits easily). */
export const EXPORT_MAX_ENTRIES = 50_000;
const LIST_LIMIT = 300;
/** A running entry whose desktop heartbeat is older than this needs a look. */
const STALE_HEARTBEAT_MS = 3 * 60_000;
const LONG_RUNNING_MS = 12 * 60 * 60_000;

export async function listTimesheetPeople(user: SessionUser) {
  if (user.role !== "ADMIN") return [];
  return prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: ["ADMIN", "EMPLOYEE"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** The range a query asks for: a month wins over a preset or custom dates. */
export function resolveQueryRange(query: TimesheetQuery, now = new Date()): DateRange {
  return query.month ? monthRange(query.month, now) : resolveRange(query.preset, { from: query.from, to: query.to }, now);
}

function assertCanView(user: SessionUser) {
  if (!roleHasPermission(user.role, "timesheet:view")) throw new AuthorizationError();
}

/** Employees are always limited to their own time, whatever the URL says. */
function scopedUserId(user: SessionUser, requested?: string) {
  return user.role === "ADMIN" ? requested : user.id;
}

function filterWhere(filter: EntryFilter): Prisma.ProjectTimeEntryWhereInput {
  switch (filter) {
    case "running":
      return { status: "RUNNING" };
    case "completed":
      return { endedAt: { not: null } };
    case "attention":
      return { OR: [{ flaggedForReview: true }, { interrupted: true }, { corrections: { some: {} } }] };
    default:
      return {};
  }
}

const ENTRY_SELECT = {
  id: true,
  userId: true,
  user: { select: { name: true, email: true } },
  projectId: true,
  project: { select: { name: true, code: true } },
  taskId: true,
  task: { select: { title: true } },
  taskDescription: true,
  notes: true,
  startedAt: true,
  endedAt: true,
  durationSeconds: true,
  status: true,
  sessionId: true,
  stopReason: true,
  source: true,
  interrupted: true,
  flaggedForReview: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { corrections: true } },
} satisfies Prisma.ProjectTimeEntrySelect;

export interface TimesheetRow extends TimesheetEntry {
  userEmail: string | null;
  projectCode: string | null;
  status: "RUNNING" | "PAUSED" | "COMPLETED";
  sessionId: string;
  /** Worked seconds recorded for the whole segment (not clipped to the range). */
  recordedSeconds: number;
  stopReason: string | null;
  source: string | null;
  interrupted: boolean;
  flagged: boolean;
  corrected: boolean;
  approved: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function loadRows(
  range: Pick<DateRange, "from" | "to" | "fromKey" | "toKey">,
  where: Prisma.ProjectTimeEntryWhereInput,
  limit: number,
  now: Date
): Promise<{ rows: TimesheetRow[]; truncated: boolean }> {
  const found = await prisma.projectTimeEntry.findMany({
    where: {
      AND: [
        { startedAt: { lt: range.to } },
        { OR: [{ endedAt: null }, { endedAt: { gt: range.from } }] },
        where,
      ],
    },
    select: ENTRY_SELECT,
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  const nowMs = now.getTime();
  const rows = found.map((r): TimesheetRow => {
    const running = r.status === "RUNNING";
    const recordedSeconds = running ? Math.max(0, Math.floor((nowMs - r.startedAt.getTime()) / 1000)) : r.durationSeconds;
    const segment = { startedAt: r.startedAt, endedAt: r.endedAt, seconds: recordedSeconds };
    // Ranges are whole days in the business zone, so day parts are kept by their key.
    const days = splitByDay(segment, now).filter((d) => d.key >= range.fromKey && d.key <= range.toKey);
    return {
      id: r.id,
      userId: r.userId,
      userName: r.user?.name ?? "Unknown",
      userEmail: r.user?.email ?? null,
      projectId: r.projectId,
      projectName: r.project.name,
      projectCode: r.project.code,
      taskId: r.taskId,
      taskTitle: r.task?.title ?? null,
      description: r.taskDescription,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      running,
      seconds: secondsInRange(segment, range.from, range.to, now),
      days,
      status: r.status,
      sessionId: r.sessionId ?? r.id,
      recordedSeconds,
      stopReason: r.stopReason,
      source: r.source,
      interrupted: r.interrupted,
      flagged: r.flaggedForReview,
      corrected: r._count.corrections > 0,
      approved: r.approvedAt !== null,
      notes: r.notes && r.notes !== r.taskDescription ? r.notes : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
  return { rows, truncated: found.length >= limit };
}

export async function getTimesheet(
  user: SessionUser,
  query: TimesheetQuery,
  now = new Date(),
  options: { limit?: number } = {}
) {
  assertCanView(user);

  const range = resolveQueryRange(query, now);
  const userId = scopedUserId(user, query.user);
  const { rows: entries, truncated } = await loadRows(
    range,
    {
      ...(userId ? { userId } : {}),
      ...(query.project ? { projectId: query.project } : {}),
      ...(query.task ? { taskId: query.task } : {}),
      ...filterWhere(query.status),
    },
    options.limit ?? MAX_ENTRIES,
    now
  );

  const totalSeconds = entries.reduce((sum, e) => sum + e.seconds, 0);
  const days = new Set(entries.flatMap((e) => (e.days ?? []).filter((d) => d.seconds > 0).map((d) => d.key)));

  return {
    range,
    entries,
    totalSeconds,
    daysWorked: days.size,
    truncated,
    groups: groupEntries(entries, query.group as GroupBy),
    list: entries.slice(0, LIST_LIMIT),
    scopedToSelf: user.role !== "ADMIN",
  };
}

export type TimesheetResult = Awaited<ReturnType<typeof getTimesheet>>;

/**
 * Today / this week / this month at a glance (always relative to now, whatever range the page
 * shows), plus completed tasks and the average per worked day this month.
 */
export async function getTimeOverview(user: SessionUser, requestedUserId?: string, now = new Date()) {
  assertCanView(user);
  const userId = scopedUserId(user, requestedUserId);
  const today = resolveRange("today", {}, now);
  const week = resolveRange("this_week", {}, now);
  const month = resolveRange("this_month", {}, now);
  const first = week.from < month.from ? week : month;
  const last = week.to > month.to ? week : month;
  const span = { from: first.from, fromKey: first.fromKey, to: last.to, toKey: last.toKey };

  const [{ rows }, completedTasks] = await Promise.all([
    loadRows(span, userId ? { userId } : {}, EXPORT_MAX_ENTRIES, now),
    prisma.task.count({
      where: {
        status: "COMPLETED",
        completedAt: { gte: month.from, lt: month.to },
        ...(userId ? { assignedToId: userId } : {}),
      },
    }),
  ]);

  const total = (r: DateRange) =>
    rows.reduce((sum, e) => sum + secondsInRange({ startedAt: e.startedAt, endedAt: e.endedAt, seconds: e.recordedSeconds }, r.from, r.to, now), 0);
  const monthDays = new Set(
    rows.flatMap((e) => (e.days ?? []).filter((d) => d.seconds > 0 && d.key >= month.fromKey && d.key <= month.toKey).map((d) => d.key))
  );
  const monthSeconds = total(month);

  return {
    todaySeconds: total(today),
    weekSeconds: total(week),
    monthSeconds,
    monthDaysWorked: monthDays.size,
    averagePerDaySeconds: monthDays.size > 0 ? Math.round(monthSeconds / monthDays.size) : 0,
    completedTasks,
    running: rows
      .filter((e) => e.running)
      .map((e) => ({ id: e.id, userName: e.userName, projectName: e.projectName, taskTitle: e.taskTitle ?? e.description, startedAt: e.startedAt })),
  };
}

/** Entries someone should look at: interrupted, over 12 h, corrected, or running with no recent desktop heartbeat. */
export async function listTimeAttention(user: SessionUser, requestedUserId?: string, now = new Date()) {
  assertCanView(user);
  const userId = scopedUserId(user, requestedUserId);
  const since = new Date(now.getTime() - 60 * 86_400_000);
  const entries = await prisma.projectTimeEntry.findMany({
    where: {
      ...(userId ? { userId } : {}),
      startedAt: { gte: since },
      OR: [
        { flaggedForReview: true },
        { interrupted: true },
        { corrections: { some: {} } },
        { status: "RUNNING", lastHeartbeatAt: { lt: new Date(now.getTime() - STALE_HEARTBEAT_MS) } },
        { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - LONG_RUNNING_MS) } },
      ],
    },
    select: {
      id: true,
      projectId: true,
      project: { select: { name: true } },
      task: { select: { title: true } },
      taskDescription: true,
      user: { select: { name: true } },
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      status: true,
      flaggedForReview: true,
      interrupted: true,
      lastHeartbeatAt: true,
      corrections: { select: { action: true, reason: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return entries.map((e) => {
    const reasons: string[] = [];
    if (e.status === "RUNNING" && e.lastHeartbeatAt && now.getTime() - e.lastHeartbeatAt.getTime() > STALE_HEARTBEAT_MS) {
      reasons.push("Running, but the desktop app hasn't confirmed activity recently");
    }
    if (e.status === "RUNNING" && now.getTime() - e.startedAt.getTime() > LONG_RUNNING_MS) reasons.push("Running for over 12 hours");
    if (e.flaggedForReview) reasons.push("Over 12 hours");
    if (e.interrupted) reasons.push("Interrupted session (closed through recovery)");
    if (e.corrections[0]) reasons.push(`Corrected: ${e.corrections[0].reason}`);
    return {
      id: e.id,
      projectId: e.projectId,
      projectName: e.project.name,
      taskTitle: e.task?.title ?? e.taskDescription,
      userName: e.user?.name ?? "Unknown",
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      seconds: e.status === "RUNNING" ? Math.max(0, Math.floor((now.getTime() - e.startedAt.getTime()) / 1000)) : e.durationSeconds,
      reasons,
    };
  });
}
