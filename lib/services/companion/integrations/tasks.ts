import { listOpenTasksDueBefore } from "@/lib/services/tasks";
import { zonedDay } from "@/lib/services/companion/time";
import { plural, type BriefingContext, type BriefingItem, type IntegrationResult } from "@/lib/services/companion/types";

// The planner part of the briefing: the user's morning checklist, then overdue, today's
// and tomorrow's open tasks from the panel's task planner.

const MAX_ITEMS_PER_GROUP = 6;
const PRIORITY_LABEL: Record<string, string> = { URGENT: "Urgent", HIGH: "High" };

type Task = Awaited<ReturnType<typeof listOpenTasksDueBefore>>[number];

function taskItem(task: Task, ctx: BriefingContext, prefix: string, status: BriefingItem["status"]): BriefingItem {
  const details = [prefix, task.dueTime ?? "", PRIORITY_LABEL[task.priority] ?? "", task.status === "IN_PROGRESS" ? "In progress" : ""];
  return {
    label: task.title,
    detail: details.filter(Boolean).join(" · "),
    status,
    url: `${ctx.appUrl}/tasks/${task.id}`,
    taskId: task.id,
    actions: task.project ? ["complete", "start-timer"] : ["complete"],
  };
}

function capped(items: BriefingItem[], total: number, ctx: BriefingContext, what: string): BriefingItem[] {
  if (total <= MAX_ITEMS_PER_GROUP) return items;
  return [
    ...items.slice(0, MAX_ITEMS_PER_GROUP),
    { label: `+${total - MAX_ITEMS_PER_GROUP} more ${what}`, status: "todo", url: `${ctx.appUrl}/planner` },
  ];
}

export async function tasksIntegration(ctx: BriefingContext): Promise<IntegrationResult> {
  const tz = ctx.settings.timezone;
  const today = zonedDay(tz, 0, ctx.now);
  const tomorrow = zonedDay(tz, 1, ctx.now);

  const checklist: BriefingItem[] = ctx.settings.checklist.map((label) => ({ label, status: "todo" }));

  const tasks = await listOpenTasksDueBefore(
    tomorrow.end,
    ctx.user,
    ctx.settings.plannerSource === "ALL_TASKS" ? "all" : "mine",
  );
  const due = (t: Task) => t.dueDate?.getTime() ?? 0;
  const overdue = tasks.filter((t) => due(t) < today.start.getTime());
  const dueToday = tasks.filter((t) => due(t) >= today.start.getTime() && due(t) < today.end.getTime());
  const dueTomorrow = tasks.filter((t) => due(t) >= tomorrow.start.getTime());

  const items: BriefingItem[] = [
    ...checklist,
    ...capped(overdue.map((t) => taskItem(t, ctx, "Overdue", "warn")), overdue.length, ctx, "overdue"),
    ...capped(dueToday.map((t) => taskItem(t, ctx, "Today", "todo")), dueToday.length, ctx, "today"),
    ...capped(dueTomorrow.map((t) => taskItem(t, ctx, "Tomorrow", "todo")), dueTomorrow.length, ctx, "tomorrow"),
  ];

  if (items.length === 0) {
    items.push({ label: "Nothing due today or tomorrow", status: "ok", url: `${ctx.appUrl}/planner` });
  }

  const parts: string[] = [];
  if (dueToday.length) parts.push(`${plural(dueToday.length, "task")} today`);
  if (overdue.length) parts.push(`${overdue.length} overdue`);

  return {
    section: { key: "tasks", title: "Today", status: overdue.length ? "warn" : "todo", items },
    summary: parts.length ? parts.join(", ") : undefined,
  };
}
