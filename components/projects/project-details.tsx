"use client";

import Link from "next/link";
import {
  FolderKanban,
  User as UserIcon,
  Building,
  Calendar,
  Clock,
  Pencil,
  FileText,
  History,
  CheckSquare,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectStatusBadge, ProjectPriorityBadge } from "@/components/shared/status-badge";
import { DeleteProjectItem } from "@/components/projects/delete-project-item";
import { ProjectAssignmentsPanel } from "@/components/projects/project-assignments-panel";
import { ProjectTasksTab } from "@/components/projects/project-tasks-tab";
import { ProjectTimerTab } from "@/components/projects/project-timer-tab";
import { formatDate, formatDateTime, formatDuration } from "@/lib/time-format";
import type { ProjectDetail } from "@/lib/services/projects";
import type { BoardTask } from "@/lib/services/tasks";
import type { SessionUser } from "@/lib/auth/session";

export function ProjectDetails({
  project,
  availableEmployees = [],
  boardTasks = [],
  sessionUser,
}: {
  project: ProjectDetail;
  boardTasks?: BoardTask[];
  availableEmployees?: Array<{ id: string; name: string; email: string; role: string }>;
  sessionUser?: SessionUser;
}) {
  const isClient = sessionUser?.role === "CLIENT";
  const isAdmin = sessionUser?.role === "ADMIN";

  // Assigned team members
  const assignedList = project.assignments?.map((a) => a.employee) || [];
  if (project.assignedTo && !assignedList.some((e) => e.id === project.assignedTo!.id)) {
    assignedList.push(project.assignedTo);
  }

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        backHref="/projects"
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span>{project.name}</span>
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
          </div>
        }
        description={project.description || "Project tracking and live time management."}
        actions={
          !isClient ? (
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${project.id}/edit`}>
                  <Pencil className="size-4 mr-1.5" /> Edit
                </Link>
              </Button>
              {isAdmin && (
                <DeleteProjectItem
                  projectId={project.id}
                  projectName={project.name}
                  trigger={
                    <Button size="sm" variant="destructive">
                      Delete
                    </Button>
                  }
                />
              )}
            </div>
          ) : undefined
        }
      />

      {/* Tabs Layout: Overview, Tasks, Timer (Spec 7) */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <FolderKanban className="size-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <CheckSquare className="size-4" />
            <span>Tasks</span>
            {project.tasks && project.tasks.length > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                {project.tasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="timer" className="gap-2">
            <Clock className="size-4" />
            <span>Timer</span>
            {project.timerStatus === "RUNNING" && (
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column (2 cols): Project Info & Admin Team Panel */}
            <div className="space-y-6 lg:col-span-2">
              {/* Admin Team Assignments Panel (Spec 4.2 & 7) */}
              {isAdmin && (
                <ProjectAssignmentsPanel
                  projectId={project.id}
                  assignments={project.assignments as any || []}
                  availableEmployees={availableEmployees}
                />
              )}

              {/* Project Information Card */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FolderKanban className="size-4 text-primary" />
                    Project Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  {project.description && (
                    <div>
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                        Description
                      </span>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-3 rounded-md border">
                        {project.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {!isClient && (
                      <div>
                        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                          Client / Customer
                        </span>
                        {project.customer ? (
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <Building className="size-3.5 text-muted-foreground" />
                            <Link
                              href={`/customers/${project.customer.id}`}
                              className="hover:underline hover:text-primary transition-colors"
                            >
                              {project.customer.name}
                            </Link>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No client assigned</span>
                        )}
                      </div>
                    )}

                    <div>
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                        Team Members
                      </span>
                      {assignedList.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {assignedList.map((emp) => (
                            <span
                              key={emp.id}
                              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-foreground font-medium"
                            >
                              <UserIcon className="size-3 text-muted-foreground" />
                              {emp.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </div>

                    <div>
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                        Start Date
                      </span>
                      <div className="flex items-center gap-1.5 text-foreground font-medium">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        <span>{formatDate(project.startDate)}</span>
                      </div>
                    </div>

                    <div>
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                        Due Date
                      </span>
                      <div className="flex items-center gap-1.5 text-foreground font-medium">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        <span>{formatDate(project.dueDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Internal Notes: Hidden from Client (Spec 4.1) */}
                  {!isClient && project.notes && (
                    <div className="pt-2 border-t">
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                        Internal Notes
                      </span>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-3 rounded-md border">
                        {project.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column (1 col): Summary & Audit Trail */}
            <div className="space-y-6">
              {/* Summary Card */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    Project Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Total Time Tracked</span>
                    <span className="font-mono font-semibold text-primary">
                      {formatDuration(project.totalDurationSeconds)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Tasks Count</span>
                    <span className="font-medium text-foreground">
                      {project.tasks?.length || 0}
                    </span>
                  </div>
                  {!isClient && (
                    <>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">Created Date</span>
                        <span className="text-foreground">{formatDate(project.createdAt)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">Created By</span>
                        <span className="text-foreground">{project.createdBy?.name || "System"}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span className="text-foreground">{formatDateTime(project.updatedAt)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Audit Trail: Hidden from clients (Spec 4.1) */}
              {!isClient && (
                <Card>
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <History className="size-4 text-primary" />
                      Audit Trail
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 text-xs">
                    {project.activityLogs?.length === 0 ? (
                      <p className="text-muted-foreground italic">No recorded activity logs yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {project.activityLogs?.slice(0, 8).map((log) => (
                          <div key={log.id} className="border-l-2 border-primary/30 pl-3 py-0.5 space-y-0.5">
                            <p className="font-medium text-foreground">{log.message}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>{formatDateTime(log.createdAt)}</span>
                              {log.user && <span>• {log.user.name}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Tasks (Spec 4.3 & 7) */}
        <TabsContent value="tasks">
          {sessionUser && (
            <ProjectTasksTab
              projectId={project.id}
              projectName={project.name}
              tasks={boardTasks}
              currentUserId={sessionUser.id}
              currentUserRole={sessionUser.role}
            />
          )}
        </TabsContent>

        {/* Tab 3: Timer (Spec 4.4, 4.5 & 7) */}
        <TabsContent value="timer">
          <ProjectTimerTab
            projectId={project.id}
            projectName={project.name}
            initialEntries={(project.timeEntries as any) || []}
            totalDurationSeconds={project.totalDurationSeconds}
            activeTimer={project.activeTimer}
            currentUserRole={sessionUser?.role}
            currentUserId={sessionUser?.id}
            tasks={project.tasks?.map((t) => ({ id: t.id, title: t.title })) || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
