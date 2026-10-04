export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listProjects, getActiveTimerForUser } from "@/lib/services/projects";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Play, ArrowRight, FolderKanban } from "lucide-react";
import { formatTimerClock } from "@/lib/time-format";

export const metadata = { title: "Timer — Priinteve Business OS" };

export default async function TimerPage() {
  const sessionUser = await requireAuth();

  // If client, send directly to their project's timer tab
  if (sessionUser.role === "CLIENT") {
    const data = await listProjects({ pageSize: 1 }, sessionUser);
    if (data.projects.length > 0) {
      redirect(`/projects/${data.projects[0].id}?tab=timer`);
    }

    return (
      <div className="space-y-6">
        <PageHeader
          title="Project Timer"
          description="Live work sessions and time tracking for your projects."
        />
        <div className="py-12 text-center text-muted-foreground">
          <Clock className="size-10 mx-auto mb-2 text-muted-foreground/50" />
          <p className="font-semibold text-foreground text-sm">No Active Projects</p>
          <p className="text-xs">There are no projects linked to your account yet.</p>
        </div>
      </div>
    );
  }

  // Employee or Admin
  const [activeTimer, projectsData] = await Promise.all([
    getActiveTimerForUser(sessionUser.id),
    listProjects({ pageSize: 50 }, sessionUser),
  ]);

  // If there is an active running timer, redirect straight to that project's timer
  if (activeTimer) {
    redirect(`/projects/${activeTimer.projectId}?tab=timer`);
  }

  // Otherwise, show assigned projects to start tracking
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Time Tracker"
        description="Select an assigned project below to start a live work session."
      />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <FolderKanban className="size-4 text-primary" />
          Your Assigned Projects ({projectsData.projects.length})
        </h2>

        {projectsData.projects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <FolderKanban className="size-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No Projects Assigned</p>
              <p className="text-xs">
                You do not have any projects assigned yet. Contact an administrator to be assigned to a project.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projectsData.projects.map((project) => (
              <Card
                key={project.id}
                className="hover:border-primary/50 transition bg-card"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold text-foreground truncate">
                      {project.name}
                    </CardTitle>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
                      {project.status.replace("_", " ")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-[11px] text-muted-foreground">
                      {project.customer?.name || "Internal"}
                    </span>
                    <Button asChild size="sm" className="h-7 text-xs gap-1">
                      <Link href={`/projects/${project.id}?tab=timer`}>
                        <Play className="size-3 fill-current" />
                        Open Timer
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
