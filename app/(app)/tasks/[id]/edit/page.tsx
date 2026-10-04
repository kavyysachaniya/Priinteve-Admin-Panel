export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getTaskDetail, taskToFormValues } from "@/lib/services/tasks";
import { listProjects } from "@/lib/services/projects";
import { requireAuth } from "@/lib/auth/session";
import { TaskForm } from "@/components/tasks/task-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Edit Task — Priinteve Business OS" };

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireAuth();
  const { id } = await params;
  const task = await getTaskDetail(id, sessionUser);
  if (!task) notFound();

  const projectsData = await listProjects({ pageSize: 100 }, sessionUser);
  const projects = projectsData.projects.map((p) => {
    const list = p.assignments?.map((a) => a.employee) || [];
    if (p.assignedTo && !list.some((e) => e.id === p.assignedTo!.id)) {
      list.push(p.assignedTo);
    }
    return {
      id: p.id,
      name: p.name,
      assignedEmployees: list,
    };
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={`Edit Task: ${task.title}`}
        description="Update task details and due dates."
      />
      <TaskForm
        taskId={task.id}
        defaultValues={taskToFormValues(task as any)}
        projects={projects}
      />
    </div>
  );
}
