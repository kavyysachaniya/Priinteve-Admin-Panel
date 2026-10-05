export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { getTaskDetail, getTaskTimeSummary, getTaskTimerContext, taskToFormValues } from "@/lib/services/tasks";
import { listProjects } from "@/lib/services/projects";
import { listTaskAttachments } from "@/lib/services/attachments";
import { listTaskComments } from "@/lib/services/task-comments";
import { isStorageConfigured } from "@/lib/services/storage";
import { getSession } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { TaskComments } from "@/components/tasks/task-comments";
import { TaskAttachments } from "@/components/tasks/task-attachments";
import { TaskTimerPanel } from "@/components/tasks/task-timer-panel";
import { TaskTimeLog } from "@/components/tasks/task-time-log";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Task Details — Priinteve Business OS" };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");

  // Scoped to what this user may see (clients: their projects; employees: assigned projects).
  const task = await getTaskDetail(id, user);
  if (!task) notFound();

  const [attachments, comments, projectsData, timer, timeSummary] = await Promise.all([
    listTaskAttachments(task.id),
    listTaskComments(task.id, user),
    listProjects({ pageSize: 100 }, user),
    getTaskTimerContext(task.id, user.id),
    getTaskTimeSummary(task.id, user),
  ]);

  const projects = projectsData.projects.map((p) => {
    const team = p.assignments?.map((a) => a.employee) ?? [];
    if (p.assignedTo && !team.some((e) => e.id === p.assignedTo!.id)) team.push(p.assignedTo);
    return { id: p.id, name: p.name, assignedEmployees: team };
  });

  // Same rule as the server: clients may only change tasks they created.
  const isOwnerClient = user.role === "CLIENT" && task.createdById === user.id;
  const canEdit = roleHasPermission(user.role, "tasks:edit") && (user.role !== "CLIENT" || isOwnerClient);
  const canDelete = roleHasPermission(user.role, "tasks:delete") && (user.role !== "CLIENT" || isOwnerClient);

  const extraPeople = [
    ...(task.assignedTo ? [{ id: task.assignedTo.id, name: task.assignedTo.name }] : []),
    ...task.mentions.map((m) => ({ id: m.employee.id, name: m.employee.name })),
  ];

  return (
    <TaskWorkspace
      taskId={task.id}
      defaultValues={taskToFormValues(task)}
      projects={projects}
      canEdit={canEdit}
      canDelete={canDelete}
      info={{
        customer: task.customer,
        order: task.order,
        createdByName: task.createdBy?.name ?? null,
        createdAt: task.createdAt.toISOString(),
        extraPeople,
      }}
      aside={
        <>
          <TaskTimerPanel
            taskId={task.id}
            taskTitle={task.title}
            projectId={task.projectId}
            taskOpen={task.status === "TODO" || task.status === "IN_PROGRESS"}
            canTime={user.role !== "CLIENT" && roleHasPermission(user.role, "projects:timer")}
            viewerId={user.id}
            timer={timer}
          />
          <TaskTimeLog summary={timeSummary} />
          <TaskComments
            taskId={task.id}
            viewerId={user.id}
            isAdmin={user.role === "ADMIN"}
            comments={comments.map((c) => ({
              id: c.id,
              body: c.body,
              authorId: c.authorId,
              authorName: c.author.name,
              authorRole: c.author.role,
              createdAt: c.createdAt.toISOString(),
              editedAt: c.editedAt?.toISOString() ?? null,
            }))}
          />
          <TaskAttachments
            taskId={task.id}
            canUpload={canEdit}
            currentUserId={user.id}
            isAdmin={user.role === "ADMIN"}
            storageConfigured={isStorageConfigured()}
            attachments={attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={task.activityLogs} />
            </CardContent>
          </Card>
        </>
      }
    />
  );
}
