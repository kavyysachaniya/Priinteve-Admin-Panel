import type { SessionUser } from "@/lib/auth/session";
import { getActiveTimerForUser } from "@/lib/services/projects";
import { listOpenTasksDueBefore } from "@/lib/services/tasks";
import { companionAppUrl, getCompanionSettings } from "@/lib/services/companion/settings";
import { zonedDay } from "@/lib/services/companion/time";
import {
  plural,
  truncate,
  type BriefingItem,
  type BriefingSection,
  type Mood,
  type ReminderPayload,
} from "@/lib/services/companion/types";

// The repeating 30-minute project check-in shown by the desktop app: whether a project
// timer is running, plus open tasks that are overdue or due today, grouped by project.

const MAX_PROJECTS = 5;
const MAX_TASKS_PER_PROJECT = 5;
const PRIORITY_LABEL: Record<string, string> = { URGENT: "Urgent", HIGH: "High" };

function elapsedLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}

export async function buildReminder(user: SessionUser, options: { origin?: string } = {}): Promise<ReminderPayload> {
  const settings = await getCompanionSettings(user.id, user.name);
  const schedule = {
    enabled: settings.reminderEnabled,
    start: settings.reminderStart,
    end: settings.reminderEnd,
    days: settings.reminderDays,
  };
  if (!settings.reminderEnabled) return { ...schedule, quiet: true, briefing: null };

  const appUrl = companionAppUrl(options.origin);
  const now = new Date();
  const today = zonedDay(settings.timezone, 0, now);

  const [timer, tasks] = await Promise.all([
    getActiveTimerForUser(user.id),
    listOpenTasksDueBefore(today.end, user, settings.plannerSource === "ALL_TASKS" ? "all" : "mine"),
  ]);

  const sections: BriefingSection[] = [];

  const timerItem: BriefingItem = timer
    ? {
        label: `Timer running: ${timer.projectName}`,
        detail: `${truncate(timer.taskTitle ?? timer.taskDescription, 80)} · ${elapsedLabel(timer.elapsedSeconds)}`,
        status: "ok",
        url: `${appUrl}/projects/${timer.projectId}`,
        actions: ["stop-timer"],
      }
    : {
        label: "No project timer is running",
        detail: "Start one from a task if you're working on a project",
        status: "warn",
        url: `${appUrl}/tasks`,
      };
  sections.push({ key: "timer", title: "Time tracking", status: timer ? "ok" : "warn", items: [timerItem] });

  // Overdue first, then today; group by project.
  const overdue = tasks.filter((t) => (t.dueDate?.getTime() ?? 0) < today.start.getTime());
  const dueToday = tasks.filter((t) => (t.dueDate?.getTime() ?? 0) >= today.start.getTime());
  const byProject = new Map<string, { id: string | null; name: string; tasks: typeof tasks }>();
  for (const task of [...overdue, ...dueToday]) {
    const key = task.project?.id ?? "none";
    const group = byProject.get(key) ?? { id: task.project?.id ?? null, name: task.project?.name ?? "No project", tasks: [] };
    group.tasks.push(task);
    byProject.set(key, group);
  }

  const groups = [...byProject.values()];
  for (const group of groups.slice(0, MAX_PROJECTS)) {
    const items: BriefingItem[] = group.tasks.slice(0, MAX_TASKS_PER_PROJECT).map((task) => {
      const isOverdue = (task.dueDate?.getTime() ?? 0) < today.start.getTime();
      return {
        label: task.title,
        detail: [isOverdue ? "Overdue" : "Due today", task.dueTime ?? "", PRIORITY_LABEL[task.priority] ?? ""]
          .filter(Boolean)
          .join(" · "),
        status: isOverdue ? "warn" : "todo",
        url: `${appUrl}/tasks/${task.id}`,
        taskId: task.id,
        actions: task.project ? ["complete", "start-timer"] : ["complete"],
      };
    });
    if (group.tasks.length > MAX_TASKS_PER_PROJECT) {
      items.push({
        label: `+${group.tasks.length - MAX_TASKS_PER_PROJECT} more`,
        status: "todo",
        url: group.id ? `${appUrl}/projects/${group.id}` : `${appUrl}/tasks`,
      });
    }
    sections.push({
      key: `project-${group.id ?? "none"}`,
      title: group.name,
      status: items.some((i) => i.status === "warn") ? "warn" : "todo",
      items,
    });
  }
  if (groups.length > MAX_PROJECTS) {
    sections.push({
      key: "more-projects",
      title: "More projects",
      status: "todo",
      items: [{ label: `${plural(groups.length - MAX_PROJECTS, "more project")} have tasks due`, status: "todo", url: `${appUrl}/tasks` }],
    });
  }

  const parts: string[] = [];
  parts.push(timer ? `Timer running on ${timer.projectName}` : "no timer running");
  if (dueToday.length) parts.push(`${plural(dueToday.length, "task")} due today`);
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  const summary = `${parts.join(", ").replace(/^./, (c) => c.toUpperCase())}.`;

  const mood: Mood = overdue.length > 0 ? "worried" : timer ? "happy" : "neutral";
  return {
    ...schedule,
    quiet: Boolean(timer) && tasks.length === 0,
    briefing: {
      generatedAt: now.toISOString(),
      mascotName: settings.mascotName,
      ownerName: settings.ownerName || user.name,
      greeting: "Project check-in",
      summary,
      mood,
      sections,
    },
  };
}
