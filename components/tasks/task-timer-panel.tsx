"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TaskTimerView {
  /** Someone's running timer on THIS task. */
  running: { userId: string; userName: string; startedAt: string } | null;
  /** The viewer's running timer on a DIFFERENT task or project (it stops if they start this one). */
  elsewhere: { projectName: string; taskTitle: string | null } | null;
}

function formatClock(startedAt: string, now: number) {
  const total = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Clock_({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-2xl font-semibold tabular-nums">{formatClock(startedAt, now)}</span>;
}

/**
 * Start or stop the timer for this task. Starting it switches off the viewer's timer on any
 * other task (the server does this; the panel just tells them). Only the person who started a
 * timer can stop it, as everywhere else.
 */
export function TaskTimerPanel({
  taskId,
  taskTitle,
  projectId,
  taskOpen,
  canTime,
  viewerId,
  timer,
}: {
  taskId: string;
  taskTitle: string;
  projectId: string | null;
  /** False for completed or cancelled tasks. */
  taskOpen: boolean;
  /** Admins and employees can track time; clients can only see it. */
  canTime: boolean;
  viewerId: string;
  timer: TaskTimerView;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const mine = timer.running?.userId === viewerId;

  async function call(url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  }

  async function start() {
    if (!projectId) return;
    setBusy(true);
    try {
      const { ok, data } = await call(`/api/projects/${projectId}/timer/start`, { taskId, taskDescription: taskTitle });
      if (!ok) {
        toast.error(typeof data.error === "string" ? data.error : "Couldn't start the timer.");
        return;
      }
      const stopped = typeof data.autoStoppedProjectName === "string" ? data.autoStoppedProjectName : null;
      toast.success(stopped ? `Timer started. Your timer on "${stopped}" was stopped.` : "Timer started");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      const { ok, data } = await call("/api/timer/stop");
      if (!ok) {
        toast.error(typeof data.error === "string" ? data.error : "Couldn't stop the timer.");
        return;
      }
      toast.success("Timer stopped");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="size-3.5" /> Time tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {timer.running ? (
          <>
            <div>
              <Clock_ startedAt={timer.running.startedAt} />
              <p className="mt-0.5 text-xs text-muted-foreground">
                {mine ? "Your timer is running on this task." : `${timer.running.userName} is working on this task.`}
              </p>
            </div>
            {mine && canTime && (
              <Button variant="destructive" size="sm" disabled={busy} onClick={stop}>
                <Square className="mr-1 size-3.5" /> {busy ? "Stopping…" : "Stop timer"}
              </Button>
            )}
          </>
        ) : !projectId ? (
          <p className="text-xs italic text-muted-foreground">Choose a project for this task to track time on it.</p>
        ) : !taskOpen ? (
          <p className="text-xs italic text-muted-foreground">Timers can&apos;t be started on completed or cancelled tasks.</p>
        ) : canTime ? (
          <>
            <Button size="sm" disabled={busy} onClick={start}>
              <Play className="mr-1 size-3.5" /> {busy ? "Starting…" : "Start timer on this task"}
            </Button>
            {timer.elsewhere && (
              <p className="text-xs text-muted-foreground">
                Your timer on <span className="font-medium text-foreground">{timer.elsewhere.taskTitle ?? timer.elsewhere.projectName}</span> will
                be stopped.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs italic text-muted-foreground">No timer is running on this task.</p>
        )}
      </CardContent>
    </Card>
  );
}
