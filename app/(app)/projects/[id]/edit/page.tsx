export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { getProjectById } from "@/lib/services/projects";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return { title: "Edit Project" };
  return { title: `Edit ${project.name} — Priinteve Business OS` };
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, customers, users] = await Promise.all([
    getProjectById(id),
    listAllActiveCustomers(),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!project) {
    notFound();
  }

  const defaultValues = {
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    priority: project.priority,
    customerId: project.customerId ?? "",
    assignedToId: project.assignedToId ?? "",
    startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "",
    dueDate: project.dueDate ? new Date(project.dueDate).toISOString().slice(0, 10) : "",
    notes: project.notes ?? "",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`Edit: ${project.name}`}
        description="Update project details, timeline, team assignment, or status."
      />
      <ProjectForm
        projectId={id}
        defaultValues={defaultValues}
        customers={customers}
        users={users}
      />
    </div>
  );
}
