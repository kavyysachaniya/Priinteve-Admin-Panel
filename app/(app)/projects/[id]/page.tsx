export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/services/projects";
import { listActiveEmployees } from "@/lib/services/users";
import { requireAuth } from "@/lib/auth/session";
import { ProjectDetails } from "@/components/projects/project-details";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return { title: "Project Not Found" };
  return { title: `${project.name} — Priinteve Business OS` };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireAuth();
  const { id } = await params;
  const project = await getProjectById(id, sessionUser);

  if (!project) {
    notFound();
  }

  const availableEmployees =
    sessionUser.role === "ADMIN" ? await listActiveEmployees() : [];

  return (
    <ProjectDetails
      project={project}
      availableEmployees={availableEmployees}
      sessionUser={sessionUser}
    />
  );
}
