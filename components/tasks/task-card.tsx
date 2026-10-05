"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, CalendarClock, FolderKanban, Loader2, MoreHorizontal, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { moveTaskAction, toggleTaskStatusAction } from "@/lib/actions/tasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskStatus } from "@prisma/client";

const MOVE_TARGETS: Array<{ status: TaskStatus; label: string }> = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "COMPLETED", label: "Completed" },
  { status: "CANCELLED", label: "Cancelled" },
];
import { TaskPriorityBadge } from "@/components/shared/status-badge";
import type { BoardTask } from "@/lib/services/tasks";

export interface BoardViewer {
  id: string;
  role: "ADMIN" | "EMPLOYEE" | "CLIENT";
}

function formatElapsed(startedAt: Date | string, now: number) {
  const total = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

function ElapsedTime({ startedAt }: { startedAt: Date | string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono tabular-nums">{formatElapsed(startedAt, now)}</span>;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function deadlineInfo(task: BoardTask) {
  if (!task.dueDate) return null;
  const due = new Date(task.dueDate);
  const done = task.status === "COMPLETED" || task.status === "CANCELLED";
  const endOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);
  const overdue = !done && endOfDue.getTime() < Date.now();
  const label = due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return { label: task.dueTime ? `${label}, ${task.dueTime}` : label, overdue };
}

export function TaskCardView({
  task,
  viewer,
  dragging,
}: {
  task: BoardTask;
  viewer: BoardViewer;
  dragging?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const deadline = deadlineInfo(task);
  const running = task.timeEntries[0];
  const runningIsMine = running?.userId === viewer.id;
  const canTime =
    viewer.role !== "CLIENT" &&
    Boolean(task.projectId) &&
    task.status !== "COMPLETED" &&
    task.status !== "CANCELLED";

  // Ticking the box completes the task (moves it to Completed); unticking reopens it as To Do.
  // The server applies the same rules as elsewhere (clients can only change tasks they created).
  const canCheck = viewer.role !== "CLIENT" || task.createdById === viewer.id;
  const checked = task.status === "COMPLETED";
  const toggleDone = async () => {
    setBusy(true);
    try {
      const res = await toggleTaskStatusAction(task.id);
      if (!res.success) throw new Error(res.message);
      toast.success(checked ? "Task reopened" : "Task completed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the task");
    } finally {
      setBusy(false);
    }
  };

  // "Move to": change the status without dragging (works with a click or on touch screens).
  const moveTo = async (status: TaskStatus, label: string) => {
    setBusy(true);
    try {
      const res = await moveTaskAction(task.id, { status, aboveId: null, belowId: null });
      if (!res.success) throw new Error(res.message);
      toast.success(`Moved to ${label}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move the task");
    } finally {
      setBusy(false);
    }
  };

  const startTimer = async () => {
    if (!task.projectId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${task.projectId}/timer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, taskDescription: task.title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start timer");
      toast.success("Timer started");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start timer");
    } finally {
      setBusy(false);
    }
  };

  const stopTimer = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/timer/stop", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not stop timer");
      toast.success("Timer stopped");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not stop timer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-lg border bg-card p-3 text-xs shadow-sm transition ${
        dragging ? "rotate-1 shadow-lg ring-2 ring-primary/40" : "hover:border-primary/40"
      } ${running ? "border-emerald-500/50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {canCheck && (
            <Checkbox
              checked={checked}
              disabled={busy}
              aria-label={checked ? "Mark task as not done" : "Mark task as done"}
              title={checked ? "Reopen task" : "Mark as done"}
              className="mt-0.5"
              // Keep a click on the box from starting a drag of the card.
              onPointerDown={(e) => e.stopPropagation()}
              onCheckedChange={toggleDone}
            />
          )}
          <Link
            href={`/tasks/${task.id}`}
            className={`font-medium leading-snug hover:underline ${
              checked ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {task.title}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TaskPriorityBadge priority={task.priority} />
          {canCheck && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Move task to another status"
                  title="Move to…"
                  // Keep a click on the menu button from starting a drag of the card.
                  onPointerDown={(e) => e.stopPropagation()}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Move to</DropdownMenuLabel>
                {MOVE_TARGETS.filter((t) => t.status !== task.status).map((t) => (
                  <DropdownMenuItem key={t.status} onSelect={() => void moveTo(t.status, t.label)}>
                    {t.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {task.project && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <FolderKanban className="size-3" />
          <span className="truncate">{task.project.name}</span>
        </p>
      )}

      {task.createdByRole === "CLIENT" && (
        <span className="mt-1.5 inline-block rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
          Client request
        </span>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        {deadline && (
          <span
            className={`flex items-center gap-1 ${deadline.overdue ? "font-semibold text-rose-600 dark:text-rose-400" : ""}`}
          >
            <CalendarClock className="size-3" />
            {deadline.label}
            {deadline.overdue && " · overdue"}
          </span>
        )}
        {task.mentions.length > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <AtSign className="size-3" />
            {task.mentions.map((m) => m.employee.name).join(", ")}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {task.assignedTo ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar className="size-5">
              <AvatarFallback className="text-[9px]">{initials(task.assignedTo.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-[11px] text-foreground">{task.assignedTo.name}</span>
          </span>
        ) : (
          <span className="text-[11px] italic text-muted-foreground">Unassigned</span>
        )}

        {running ? (
          runningIsMine ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={stopTimer}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Square className="size-3" />}
              <ElapsedTime startedAt={running.startedAt} />
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              {running.user?.name ?? "Someone"}
              {viewer.role === "CLIENT" ? " is working" : <> · <ElapsedTime startedAt={running.startedAt} /></>}
            </span>
          )
        ) : (
          canTime && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={startTimer}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
              Start
            </Button>
          )
        )}
      </div>
    </div>
  );
}
