"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  Clock,
  Timer,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimerStatusBadge } from "@/components/shared/status-badge";
import {
  startProjectTimerAction,
  pauseProjectTimerAction,
  resumeProjectTimerAction,
  stopProjectTimerAction,
} from "@/lib/actions/projects";
import { formatDuration, formatTimerClock } from "@/lib/time-format";
import { toast } from "sonner";
import type { ProjectDetail } from "@/lib/services/projects";

export function ProjectTimerCard({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  // Active timer information passed from server
  const activeTimer = project.activeTimer;
  const isRunning = project.timerStatus === "RUNNING";
  const isPaused = project.timerStatus === "PAUSED";
  const isCompleted = project.status === "COMPLETED";

  // Calculate live session seconds from server timestamp
  const calculateSessionSeconds = () => {
    if (!activeTimer) return 0;
    const now = Date.now();
    const started = new Date(activeTimer.startedAt).getTime();
    return Math.max(0, Math.floor((now - started) / 1000));
  };

  const [sessionSeconds, setSessionSeconds] = useState(calculateSessionSeconds);

  // Update session seconds every second if timer is running
  useEffect(() => {
    if (!isRunning || !activeTimer) {
      setSessionSeconds(0);
      return;
    }

    // Set initial accurate value
    setSessionSeconds(calculateSessionSeconds());

    const interval = setInterval(() => {
      setSessionSeconds(calculateSessionSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, activeTimer]);

  // Compute live total duration: completed entries + current active running session
  const completedDuration = isRunning && activeTimer
    ? Math.max(0, project.totalDurationSeconds - activeTimer.elapsedSeconds)
    : project.totalDurationSeconds;

  const liveTotalSeconds = completedDuration + sessionSeconds;

  // Handlers with double-click protection and error handling
  const handleStart = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await startProjectTimerAction(project.id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start timer");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePause = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await pauseProjectTimerAction(project.id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to pause timer");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResume = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await resumeProjectTimerAction(project.id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resume timer");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStop = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await stopProjectTimerAction(project.id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to stop timer");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-border bg-gradient-to-b from-card via-card to-muted/20 shadow-sm overflow-hidden">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Header Row: Label & Status Badge */}
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Timer className="size-3.5 text-primary" />
              Time Tracker
            </span>
            <TimerStatusBadge status={project.timerStatus} />
          </div>

          {/* Active User Notice if another team member is tracking */}
          {isRunning && activeTimer?.userName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <UserIcon className="size-3.5" />
              <span>
                Active Session by <strong className="font-semibold">{activeTimer.userName}</strong>
              </span>
            </div>
          )}

          {/* Main Giant Clock Display */}
          <div className="space-y-1">
            <div className="font-mono text-5xl md:text-6xl font-extrabold tracking-tight tabular-nums text-foreground drop-shadow-xs">
              {isRunning
                ? formatTimerClock(sessionSeconds)
                : isPaused
                ? formatTimerClock(0)
                : "00:00:00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {isRunning
                ? "Current Session in Progress"
                : isPaused
                ? "Timer is Paused"
                : isCompleted
                ? "Project Completed"
                : "Timer is Ready to Start"}
            </p>
          </div>

          {/* Action Control Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* IDLE state */}
            {!isRunning && !isPaused && !isCompleted && (
              <Button
                size="lg"
                className="h-11 px-6 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
                onClick={handleStart}
                disabled={isProcessing}
              >
                <Play className="size-4 mr-2 fill-current" />
                Start Timer
              </Button>
            )}

            {/* RUNNING state */}
            {isRunning && (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-6 font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 active:scale-95"
                  onClick={handlePause}
                  disabled={isProcessing}
                >
                  <Pause className="size-4 mr-2 fill-current" />
                  Pause
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-6 font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 active:scale-95"
                  onClick={handleStop}
                  disabled={isProcessing}
                >
                  <Square className="size-4 mr-2 fill-current" />
                  Stop Timer
                </Button>
              </>
            )}

            {/* PAUSED state */}
            {isPaused && (
              <>
                <Button
                  size="lg"
                  className="h-11 px-6 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95"
                  onClick={handleResume}
                  disabled={isProcessing}
                >
                  <Play className="size-4 mr-2 fill-current" />
                  Resume
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-6 font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 active:scale-95"
                  onClick={handleStop}
                  disabled={isProcessing}
                >
                  <Square className="size-4 mr-2 fill-current" />
                  Stop Timer
                </Button>
              </>
            )}

            {/* COMPLETED state */}
            {isCompleted && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/40 border">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <span>This project is completed. Reopen or edit project status to record additional time.</span>
              </div>
            )}
          </div>

          {/* Total Tracked Time Footer */}
          <div className="w-full pt-6 mt-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 text-primary" />
              <span>Total Tracked Time:</span>
              <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                {formatDuration(liveTotalSeconds)}
              </span>
            </div>

            <div className="text-muted-foreground">
              <span>Recorded Sessions: </span>
              <span className="font-semibold text-foreground">{project.timeEntries.length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
