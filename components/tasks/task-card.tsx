"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, CalendarClock, FolderKanban, Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
        <Link
          href={`/tasks/${task.id}`}
          className={`font-medium leading-snug hover:underline ${
            task.status === "COMPLETED" ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {task.title}
        </Link>
        <TaskPriorityBadge priority={task.priority} />
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
