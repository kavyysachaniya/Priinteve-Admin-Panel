"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Clock,
  Calendar,
  CheckCircle2,
  ListTodo,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectStatusBadge, ProjectPriorityBadge } from "@/components/shared/status-badge";
import { formatDate, formatDuration } from "@/lib/time-format";
import type { ProjectListItem } from "@/lib/services/projects";

export function ClientProjectDashboard({
  projects,
}: {
  projects: ProjectListItem[];
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id || ""
  );

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4 text-primary">
          <FolderKanban className="size-10" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Welcome to Your Project Portal
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          There are currently no active projects linked to your account. When our team starts a project for you, it will appear right here.
        </p>
      </div>
    );
  }

  const project =
    projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Tasks statistics
  const tasks = project.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const todoTasks = tasks.filter((t) => t.status === "TODO").length;

  const progressPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Project Dashboard</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time status, progress tracking, and work logged by our team.
          </p>
        </div>

        {/* Project Switcher if multiple projects exist */}
        {projects.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Select Project:
            </span>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger className="w-56 h-9 text-xs">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Main Project Overview Card */}
      <Card className="overflow-hidden border shadow-sm">
        <div className="bg-muted/30 border-b px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-foreground">{project.name}</h2>
              <ProjectStatusBadge status={project.status} />
              <ProjectPriorityBadge priority={project.priority} />
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground max-w-2xl">
                {project.description}
              </p>
            )}
          </div>

          <Button asChild size="sm" className="gap-1.5 shadow-xs">
            <Link href={`/projects/${project.id}`}>
              Full Project View
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Time Logged */}
            <div className="p-4 rounded-xl border bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Total Time Logged</span>
                <Clock className="size-4 text-primary" />
              </div>
              <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {formatDuration(project.totalDurationSeconds)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Logged by assigned team
              </p>
            </div>

            {/* Live Work Indicator */}
            <div className={`p-4 rounded-xl border space-y-1 transition ${
              project.activeTimer ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card/60"
            }`}>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Current Status</span>
                {project.activeTimer ? (
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                  </span>
                ) : (
                  <CheckCircle2 className="size-4 text-muted-foreground/60" />
                )}
              </div>
              {project.activeTimer ? (
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Live Session Active
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {project.activeTimer.userName || "Team member"} • {project.activeTimer.taskDescription || "Working on project"}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Idle
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No team members tracking time right now
                  </p>
                </div>
              )}
            </div>

            {/* Task Progress */}
            <div className="p-4 rounded-xl border bg-card/60 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Task Progress</span>
                <ListTodo className="size-4 text-primary" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground tracking-tight">
                  {progressPercentage}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {completedTasks} of {totalTasks} done
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Target Delivery Date */}
            <div className="p-4 rounded-xl border bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Target Delivery</span>
                <Calendar className="size-4 text-primary" />
              </div>
              <p className="text-lg font-bold text-foreground">
                {project.dueDate ? formatDate(project.dueDate) : "Flexible"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Started {project.startDate ? formatDate(project.startDate) : "recently"}
              </p>
            </div>
          </div>

          {/* Task Breakdown & Quick Action Links */}
          <div className="grid gap-6 md:grid-cols-2 pt-2">
            {/* Task Summary Card */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ListTodo className="size-4 text-primary" />
                    Task Status Breakdown
                  </span>
                  <Link
                    href={`/projects/${project.id}?tab=tasks`}
                    className="text-xs text-primary font-normal hover:underline flex items-center gap-0.5"
                  >
                    View all <ChevronRight className="size-3" />
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b">
                  <span className="text-muted-foreground">To Do / Requests</span>
                  <span className="font-semibold text-foreground">{todoTasks}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b">
                  <span className="text-muted-foreground">In Progress</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {inProgressTasks}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {completedTasks}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Work Sessions Summary Card */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    Live Activity
                  </span>
                  <Link
                    href={`/projects/${project.id}?tab=timer`}
                    className="text-xs text-primary font-normal hover:underline flex items-center gap-0.5"
                  >
                    Details <ChevronRight className="size-3" />
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-xs space-y-3">
                <p className="text-muted-foreground leading-relaxed">
                  Our team logs real-time work sessions against this project. You can inspect the recent sessions, time per task, and verify active work without any hidden costs.
                </p>
                <div className="pt-2">
                  <Button asChild variant="outline" size="sm" className="w-full text-xs">
                    <Link href={`/projects/${project.id}`}>
                      Open Project Workspace
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
