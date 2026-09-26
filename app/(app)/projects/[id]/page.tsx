export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/services/projects";
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
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  return <ProjectDetails project={project} />;
}
