import { prisma } from "@/lib/prisma";

export async function createNotification({
  userId,
  title,
  message,
  type = "INFO",
  link,
}: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
}) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link: link ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
    return null;
  }
}

export async function listUserNotifications(userId: string, limit = 10) {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function getUnreadNotificationCount(userId: string) {
  try {
    return await prisma.notification.count({
      where: { userId, read: false },
    });
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string, userId: string) {
  try {
    return await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  } catch (err) {
    console.error("Failed to mark notification read:", err);
  }
}

export async function markAllNotificationsRead(userId: string) {
  try {
    return await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  } catch (err) {
    console.error("Failed to mark all notifications read:", err);
  }
}

// ---------------------------------------------------------------------------
// Due-time reminders. There is no scheduler, so the notification bell's poll (every ~20 s)
// asks for these: tasks assigned to the user that are due within the next hour, due today,
// or that just became overdue. Each is created once (de-duplicated on type + task link).
// ---------------------------------------------------------------------------

const DUE_SOON_MINUTES = 60;
const DUE_CHECK_INTERVAL_MS = 2 * 60 * 1000;
const DEDUPE_WINDOW_MS = 48 * 60 * 60 * 1000;
const lastDueCheck = new Map<string, number>();

/** Task due times are entered as wall-clock times in the business time zone (default IST, +05:30). */
function utcOffsetMinutes(): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(process.env.APP_UTC_OFFSET ?? "+05:30");
  if (!m) return 330;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** The moment a task is due, from its date and optional HH:MM time; null when it has no time. */
export function taskDueInstant(dueDate: Date, dueTime: string | null): Date | null {
  if (!dueTime || !/^\d{2}:\d{2}$/.test(dueTime)) return null;
  const day = dueDate.toISOString().slice(0, 10);
  const [h, m] = dueTime.split(":").map(Number);
  const wallAsUtc = Date.parse(`${day}T00:00:00Z`) + (h * 60 + m) * 60_000;
  return new Date(wallAsUtc - utcOffsetMinutes() * 60_000);
}

export async function ensureDueNotifications(userId: string, now = new Date()) {
  const last = lastDueCheck.get(userId) ?? 0;
  if (now.getTime() - last < DUE_CHECK_INTERVAL_MS) return;
  lastDueCheck.set(userId, now.getTime());

  try {
    const dayMs = 24 * 60 * 60 * 1000;
    const todayKey = new Date(now.getTime() + utcOffsetMinutes() * 60_000).toISOString().slice(0, 10);
    const today = Date.parse(`${todayKey}T00:00:00Z`);

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: new Date(today - dayMs), lte: new Date(today + dayMs) },
      },
      select: { id: true, title: true, dueDate: true, dueTime: true, project: { select: { name: true } } },
      take: 100,
    });
    if (tasks.length === 0) return;

    const existing = await prisma.notification.findMany({
      where: {
        userId,
        type: { in: ["TASK_DUE_SOON", "TASK_DUE_TODAY", "TASK_OVERDUE"] },
        createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
      },
      select: { type: true, link: true },
    });
    const seen = new Set(existing.map((n) => `${n.type}:${n.link}`));

    for (const task of tasks) {
      if (!task.dueDate) continue;
      const link = `/tasks/${task.id}`;
      const where = task.project?.name ? ` in "${task.project.name}"` : "";
      const dayStart = Date.parse(`${task.dueDate.toISOString().slice(0, 10)}T00:00:00Z`);
      const due = taskDueInstant(task.dueDate, task.dueTime);

      let type: string | null = null;
      let title = "";
      let message = "";
      if (due) {
        const minutes = Math.round((due.getTime() - now.getTime()) / 60_000);
        if (minutes > 0 && minutes <= DUE_SOON_MINUTES) {
          type = "TASK_DUE_SOON";
          title = "Task due soon";
          message = `"${task.title}"${where} is due in ${minutes} minute${minutes === 1 ? "" : "s"} (${task.dueTime}).`;
        } else if (minutes <= 0 && minutes > -24 * 60) {
          type = "TASK_OVERDUE";
          title = "Task overdue";
          message = `"${task.title}"${where} was due at ${task.dueTime} and is still open.`;
        }
      } else if (dayStart === today) {
        type = "TASK_DUE_TODAY";
        title = "Task due today";
        message = `"${task.title}"${where} is due today.`;
      } else if (dayStart === today - dayMs) {
        type = "TASK_OVERDUE";
        title = "Task overdue";
        message = `"${task.title}"${where} was due yesterday and is still open.`;
      }
      if (!type || seen.has(`${type}:${link}`)) continue;
      seen.add(`${type}:${link}`);
      await createNotification({ userId, title, message, type, link });
    }
  } catch (err) {
    console.error("Failed to create due-time notifications:", err instanceof Error ? err.message : "unknown");
  }
}
