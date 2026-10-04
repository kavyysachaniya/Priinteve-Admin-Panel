"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimerClock } from "@/lib/time-format";

interface ActiveTimerData {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  taskDescription: string | null;
  taskId: string | null;
}

export function ActiveTimerHeaderChip() {
  const router = useRouter();
  const [timer, setTimer] = useState<ActiveTimerData | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [taskDescription, setTaskDescription] = useState("");
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/timer/active");
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.activeTimer) {
            setTimer({
              ...data.activeTimer,
              startedAt: data.activeTimer.startedAt,
            });
            setTaskDescription(data.activeTimer.taskDescription || "");
          } else {
            setTimer(null);
          }
        }
      } catch {
        // Silently fail if network interrupted
      }
    };

    void load();
    const interval = setInterval(load, 15000);
    const handleTimerChanged = () => void load();

    window.addEventListener("timer-changed", handleTimerChanged);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("timer-changed", handleTimerChanged);
    };
  }, []);

  useEffect(() => {
    if (!timer?.startedAt) return;

    const startedTime = new Date(timer.startedAt).getTime();
    const updateElapsed = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startedTime) / 1000));
      setElapsedSeconds(diff);
    };

    const frame = requestAnimationFrame(updateElapsed);
    const ticker = setInterval(updateElapsed, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(ticker);
    };
  }, [timer?.startedAt]);

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await fetch("/api/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskDescription: taskDescription.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to stop timer");
      }

      toast.success("Timer stopped.");
      setTimer(null);
      setStopModalOpen(false);
      window.dispatchEvent(new CustomEvent("timer-changed"));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to stop timer");
    } finally {
      setStopping(false);
    }
  };

  if (!timer) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>

        <Link
          href={`/projects/${timer.projectId}`}
          className="max-w-[120px] truncate hover:underline sm:max-w-[160px]"
          title={timer.projectName}
        >
          {timer.projectName}
        </Link>

        <span className="font-mono font-semibold tracking-wider">
          {formatTimerClock(elapsedSeconds)}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="size-5 rounded-full p-0 text-emerald-700 hover:bg-emerald-500/20 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
          onClick={() => setStopModalOpen(true)}
          title="Stop Timer"
        >
          <Square className="size-3 fill-current" />
          <span className="sr-only">Stop Timer</span>
        </Button>
      </div>

      <Dialog open={stopModalOpen} onOpenChange={setStopModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stop Timer</DialogTitle>
            <DialogDescription>
              Stop tracking time on <strong>{timer.projectName}</strong>. Recorded duration:{" "}
              <span className="font-mono font-medium text-foreground">
                {formatTimerClock(elapsedSeconds)}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="stop-task-description">Task Description (optional edit)</Label>
            <Input
              id="stop-task-description"
              placeholder="What did you work on?"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStopModalOpen(false)}
              disabled={stopping}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleStop}
              disabled={stopping}
              className="gap-1.5"
            >
              {stopping ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Square className="size-3.5 fill-current" />
              )}
              Stop Timer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
