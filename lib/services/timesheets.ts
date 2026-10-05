import { prisma } from "@/lib/prisma";
import { AuthorizationError, type SessionUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import { dayKeyInZone, groupEntries, resolveRange, type GroupBy, type TimesheetEntry } from "@/lib/timesheet";
import type { TimesheetQuery } from "@/lib/validations/timesheet";

// Timesheets: who worked how long, per task, project, person or day, over any date range.
// Employees see only their own time; admins can look at anyone's. Clients have no access.
// All stopped time counts, whether or not it has been shared with a client.

const MAX_ENTRIES = 5000;
const LIST_LIMIT = 300;

export async function listTimesheetPeople(user: SessionUser) {
  if (user.role !== "ADMIN") return [];
  return prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: ["ADMIN", "EMPLOYEE"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getTimesheet(user: SessionUser, query: TimesheetQuery, now = new Date()) {
  if (!roleHasPermission(user.role, "timesheet:view")) throw new AuthorizationError();

  const range = resolveRange(query.preset, { from: query.from, to: query.to }, now);
  // Employees are always limited to their own time, whatever the URL says.
  const userId = user.role === "ADMIN" ? query.user : user.id;

  const rows = await prisma.projectTimeEntry.findMany({
    where: {
      startedAt: { gte: range.from, lt: range.to },
      ...(userId ? { userId } : {}),
      ...(query.project ? { projectId: query.project } : {}),
      ...(query.task ? { taskId: query.task } : {}),
    },
    select: {
      id: true,
      userId: true,
      user: { select: { name: true } },
      projectId: true,
      project: { select: { name: true } },
      taskId: true,
      task: { select: { title: true } },
      taskDescription: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      status: true,
    },
    orderBy: { startedAt: "desc" },
    take: MAX_ENTRIES,
  });

  const nowMs = now.getTime();
  const entries: TimesheetEntry[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user?.name ?? "Unknown",
    projectId: r.projectId,
    projectName: r.project.name,
    taskId: r.taskId,
    taskTitle: r.task?.title ?? null,
    description: r.taskDescription,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    running: r.status === "RUNNING",
    seconds: r.status === "RUNNING" ? Math.max(0, Math.floor((nowMs - r.startedAt.getTime()) / 1000)) : r.durationSeconds,
  }));

  const totalSeconds = entries.reduce((sum, e) => sum + e.seconds, 0);
  const days = new Set(entries.map((e) => dayKeyInZone(e.startedAt)));

  return {
    range,
    entries,
    totalSeconds,
    daysWorked: days.size,
    truncated: rows.length >= MAX_ENTRIES,
    groups: groupEntries(entries, query.group as GroupBy),
    list: entries.slice(0, LIST_LIMIT),
    scopedToSelf: user.role !== "ADMIN",
  };
}

export type TimesheetResult = Awaited<ReturnType<typeof getTimesheet>>;
