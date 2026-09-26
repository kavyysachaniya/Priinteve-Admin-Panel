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
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectStatusBadge, ProjectPriorityBadge } from "@/components/shared/status-badge";
import { ProjectTimerCard } from "@/components/projects/project-timer-card";
import { ProjectTimeEntriesTable } from "@/components/projects/project-time-entries-table";
import { DeleteProjectItem } from "@/components/projects/delete-project-item";
import { formatDate, formatDateTime } from "@/lib/time-format";
import type { ProjectDetail } from "@/lib/services/projects";

export function ProjectDetails({ project }: { project: ProjectDetail }) {
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
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${project.id}/edit`}>
                <Pencil className="size-4 mr-1.5" /> Edit
              </Link>
            </Button>
            <DeleteProjectItem
              projectId={project.id}
              projectName={project.name}
              trigger={
                <Button size="sm" variant="destructive">
                  Delete
                </Button>
              }
            />
          </div>
        }
      />

      {/* Primary Highlight: LIVE TIME TRACKER */}
      <ProjectTimerCard project={project} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols): Project Info & Time Entries History */}
        <div className="space-y-6 lg:col-span-2">
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

                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                    Assigned Team Member
                  </span>
                  {project.assignedTo ? (
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <UserIcon className="size-3.5 text-muted-foreground" />
                      <span>{project.assignedTo.name}</span>
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

              {project.notes && (
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

          {/* Time Entries Table (Section 7) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Time Entries
              </h2>
            </div>
            <ProjectTimeEntriesTable
              entries={project.timeEntries}
              totalDurationSeconds={project.totalDurationSeconds}
            />
          </div>
        </div>

        {/* Right Column (1 col): Audit Trail & Metadata */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Project Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Project ID</span>
                <span className="font-mono text-[11px] text-foreground">{project.id}</span>
              </div>
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
            </CardContent>
          </Card>

          {/* Audit Trail Card (Section 19) */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="size-4 text-primary" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 text-xs">
              {project.activityLogs.length === 0 ? (
                <p className="text-muted-foreground italic">No recorded activity logs yet.</p>
              ) : (
                <div className="space-y-3">
                  {project.activityLogs.slice(0, 10).map((log) => (
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
        </div>
      </div>
    </div>
  );
}
