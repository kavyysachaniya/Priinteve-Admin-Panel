export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { listProjects } from "@/lib/services/projects";
import { requireAuth } from "@/lib/auth/session";

export const metadata = { title: "Create Task — Priinteve Business OS" };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const sessionUser = await requireAuth();
  const params = await searchParams;

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
        title="Create Operational Task"
        description="Assign or schedule a new task within a project."
      />
      <TaskForm
        defaultValues={{ projectId: params.projectId || "" }}
        projects={projects}
      />
    </div>
  );
}
