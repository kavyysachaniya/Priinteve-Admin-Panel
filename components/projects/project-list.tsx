"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Eye,
  Pencil,
  Play,
  Pause,
  Square,
  Clock,
  Plus,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import { ProjectStatusBadge, ProjectPriorityBadge, TimerStatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { QuickAction, RowActionsBar } from "@/components/shared/row-actions";
import { DeleteProjectItem } from "@/components/projects/delete-project-item";
import {
  startProjectTimerAction,
  pauseProjectTimerAction,
  resumeProjectTimerAction,
  stopProjectTimerAction,
} from "@/lib/actions/projects";
import { formatDuration, formatTimerClock, formatDate } from "@/lib/time-format";
import { toast } from "sonner";
import type { ProjectListItem } from "@/lib/services/projects";

function ProjectTimerControls({
  project,
  onActionComplete,
}: {
  project: ProjectListItem;
  onActionComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await startProjectTimerAction(project.id);
      if (res.success) {
        toast.success(res.message);
        onActionComplete();
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await pauseProjectTimerAction(project.id);
      if (res.success) {
        toast.success(res.message);
        onActionComplete();
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await resumeProjectTimerAction(project.id);
      if (res.success) {
        toast.success(res.message);
        onActionComplete();
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await stopProjectTimerAction(project.id);
      if (res.success) {
        toast.success(res.message);
        onActionComplete();
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (project.timerStatus === "RUNNING") {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
          onClick={handlePause}
          disabled={loading}
          title="Pause Timer"
        >
          <Pause className="size-3 mr-1 fill-current" /> Pause
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={handleStop}
          disabled={loading}
          title="Stop Timer"
        >
          <Square className="size-3 mr-1 fill-current" /> Stop
        </Button>
      </div>
    );
  }

  if (project.timerStatus === "PAUSED") {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          onClick={handleResume}
          disabled={loading}
          title="Resume Timer"
        >
          <Play className="size-3 mr-1 fill-current" /> Resume
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={handleStop}
          disabled={loading}
          title="Stop Timer"
        >
          <Square className="size-3 mr-1 fill-current" /> Stop
        </Button>
      </div>
    );
  }

  if (project.status === "COMPLETED") {
    return <span className="text-xs text-muted-foreground italic">Completed</span>;
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
      onClick={handleStart}
      disabled={loading}
    >
      <Play className="size-3 mr-1 fill-current" /> Start Timer
    </Button>
  );
}

function LiveDurationCell({
  totalDurationSeconds,
  activeTimer,
}: {
  totalDurationSeconds: number;
  activeTimer: ProjectListItem["activeTimer"];
}) {
  const [currentElapsed, setCurrentElapsed] = useState(() => {
    if (!activeTimer) return totalDurationSeconds;
    const now = Date.now();
    const started = new Date(activeTimer.startedAt).getTime();
    const sessionSeconds = Math.max(0, Math.floor((now - started) / 1000));
    return totalDurationSeconds - activeTimer.elapsedSeconds + sessionSeconds;
  });

  useEffect(() => {
    if (!activeTimer) {
      setCurrentElapsed(totalDurationSeconds);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const started = new Date(activeTimer.startedAt).getTime();
      const sessionSeconds = Math.max(0, Math.floor((now - started) / 1000));
      setCurrentElapsed(totalDurationSeconds - activeTimer.elapsedSeconds + sessionSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer, totalDurationSeconds]);

  return (
    <div className="font-mono text-xs font-semibold tabular-nums text-foreground flex items-center gap-1.5">
      <Clock className="size-3.5 text-muted-foreground shrink-0" />
      <span>{formatDuration(currentElapsed)}</span>
    </div>
  );
}

export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No Projects Yet"
        description="Create your first project to start tracking work and time."
        action={
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-4 mr-1.5" /> + Add Project
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Project Name & Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Priority</TableHead>
            <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
            <TableHead className="hidden xl:table-cell">Timeline</TableHead>
            <TableHead>Tracked Time</TableHead>
            <TableHead>Timer Status</TableHead>
            <TableHead className="text-right">Quick Timer</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id} className="hover:bg-muted/40 transition-colors">
              {/* Project Name & Description */}
              <TableCell className="align-top py-3">
                <div className="space-y-1">
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-semibold text-sm text-foreground hover:text-primary transition-colors hover:underline block line-clamp-1"
                  >
                    {project.name}
                  </Link>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                  )}
                  {project.customer && (
                    <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                      <span>Client:</span>
                      <span className="font-medium text-foreground/80">{project.customer.name}</span>
                    </p>
                  )}
                </div>
              </TableCell>

              {/* Status */}
              <TableCell className="align-top py-3">
                <ProjectStatusBadge status={project.status} />
              </TableCell>

              {/* Priority */}
              <TableCell className="align-top py-3 hidden md:table-cell">
                <ProjectPriorityBadge priority={project.priority} />
              </TableCell>

              {/* Assigned To */}
              <TableCell className="align-top py-3 hidden lg:table-cell text-xs text-muted-foreground">
                {project.assignedTo ? (
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <UserIcon className="size-3 text-muted-foreground" />
                    {project.assignedTo.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Unassigned</span>
                )}
              </TableCell>

              {/* Timeline (Start - Due Date) */}
              <TableCell className="align-top py-3 hidden xl:table-cell text-xs text-muted-foreground">
                <div className="space-y-0.5">
                  {project.startDate && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <Calendar className="size-3 text-muted-foreground" />
                      <span>Start: {formatDate(project.startDate)}</span>
                    </div>
                  )}
                  {project.dueDate ? (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                      <Calendar className="size-3 text-muted-foreground" />
                      <span>Due: {formatDate(project.dueDate)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic text-[11px]">No due date</span>
                  )}
                </div>
              </TableCell>

              {/* Total Time Spent */}
              <TableCell className="align-top py-3">
                <LiveDurationCell
                  totalDurationSeconds={project.totalDurationSeconds}
                  activeTimer={project.activeTimer}
                />
              </TableCell>

              {/* Current Timer Status */}
              <TableCell className="align-top py-3">
                <TimerStatusBadge status={project.timerStatus} />
              </TableCell>

              {/* Quick Timer Controls */}
              <TableCell className="align-top py-3 text-right">
                <ProjectTimerControls project={project} onActionComplete={() => router.refresh()} />
              </TableCell>

              {/* Row Actions Menu */}
              <TableCell className="align-top py-3">
                <RowActionsBar>
                  <QuickAction href={`/projects/${project.id}`} label="View Project" icon={<Eye className="size-4" />} />
                  <QuickAction href={`/projects/${project.id}/edit`} label="Edit Project" icon={<Pencil className="size-4" />} />
                  <DeleteProjectItem projectId={project.id} projectName={project.name} />
                </RowActionsBar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
