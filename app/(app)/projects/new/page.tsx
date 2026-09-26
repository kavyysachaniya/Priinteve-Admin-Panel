export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Create Project — Priinteve Business OS" };

export default async function NewProjectPage() {
  const [customers, users] = await Promise.all([
    listAllActiveCustomers(),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Create New Project"
        description="Define project scope, assign team members, and prepare for live time tracking."
      />
      <ProjectForm customers={customers} users={users} />
    </div>
  );
}
