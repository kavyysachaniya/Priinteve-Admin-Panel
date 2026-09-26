"use client";

import { FolderKanban, PlayCircle, CheckCircle2, Clock, Timer, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/time-format";

interface ProjectStats {
  totalProjects: number;
  inProgressProjects: number;
  completedProjects: number;
  notStartedProjects: number;
  onHoldProjects: number;
  totalTrackedSeconds: number;
  activeTimersCount: number;
}

export function ProjectStatsCards({ stats }: { stats: ProjectStats }) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {/* Total Projects */}
      <Card className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Total Projects</span>
          <FolderKanban className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{stats.totalProjects}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">All workspaces</p>
        </div>
      </Card>

      {/* In Progress */}
      <Card className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>In Progress</span>
          <Clock className="size-4 text-blue-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{stats.inProgressProjects}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Under active work</p>
        </div>
      </Card>

      {/* Completed */}
      <Card className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Completed</span>
          <CheckCircle2 className="size-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{stats.completedProjects}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Delivered / finished</p>
        </div>
      </Card>

      {/* Not Started */}
      <Card className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Not Started</span>
          <PlayCircle className="size-4 text-amber-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{stats.notStartedProjects}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">In backlog queue</p>
        </div>
      </Card>

      {/* Total Tracked Time */}
      <Card className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Tracked Time</span>
          <Timer className="size-4 text-purple-500" />
        </div>
        <div>
          <p className="text-xl font-bold text-foreground tracking-tight truncate">
            {formatDuration(stats.totalTrackedSeconds)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Total recorded</p>
        </div>
      </Card>

      {/* Currently Running */}
      <Card className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Active Timers</span>
          <Activity className="size-4 text-emerald-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-foreground tracking-tight">{stats.activeTimersCount}</p>
            {stats.activeTimersCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Running live now</p>
        </div>
      </Card>
    </div>
  );
}
