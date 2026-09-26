export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectStatsCards } from "@/components/projects/project-stats-cards";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listProjects, getProjectStats } from "@/lib/services/projects";
import { Plus } from "lucide-react";
import type { ProjectPriority, ProjectStatus } from "@prisma/client";

export const metadata = { title: "Projects — Priinteve Business OS" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    hasActiveTimer?: string;
    sort?: string;
    order?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const [data, stats] = await Promise.all([
    listProjects({
      q: params.q,
      status: (params.status as ProjectStatus) || undefined,
      priority: (params.priority as ProjectPriority) || undefined,
      hasActiveTimer: params.hasActiveTimer === "true",
      sort: (params.sort as any) || undefined,
      order: (params.order as "asc" | "desc") || undefined,
      page,
    }),
    getProjectStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Projects"
        description="Create projects, assign team members, and track real-time work sessions."
        actions={
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-4 mr-1.5" /> + Add Project
            </Link>
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <ProjectStatsCards stats={stats} />

      {/* Search, Filters & Sorting Toolbar */}
      <TableToolbar placeholder="Search projects by name, client, or assignee…">
        {/* Status Filter */}
        <TableFilterSelect
          paramName="status"
          placeholder="All Statuses"
          options={[
            { label: "All Statuses", value: "" },
            { label: "Not Started", value: "NOT_STARTED" },
            { label: "In Progress", value: "IN_PROGRESS" },
            { label: "On Hold", value: "ON_HOLD" },
            { label: "Completed", value: "COMPLETED" },
            { label: "Cancelled", value: "CANCELLED" },
          ]}
        />

        {/* Priority Filter */}
        <TableFilterSelect
          paramName="priority"
          placeholder="All Priorities"
          options={[
            { label: "All Priorities", value: "" },
            { label: "Low", value: "LOW" },
            { label: "Medium", value: "MEDIUM" },
            { label: "High", value: "HIGH" },
            { label: "Urgent", value: "URGENT" },
          ]}
        />

        {/* Active Timer Filter */}
        <TableFilterSelect
          paramName="hasActiveTimer"
          placeholder="Active Timer"
          options={[
            { label: "All Timers", value: "" },
            { label: "Currently Running", value: "true" },
          ]}
        />

        {/* Sort By */}
        <TableFilterSelect
          paramName="sort"
          placeholder="Sort By"
          options={[
            { label: "Created Date", value: "createdAt" },
            { label: "Due Date", value: "dueDate" },
            { label: "Project Name", value: "name" },
            { label: "Total Time", value: "totalTime" },
            { label: "Priority", value: "priority" },
          ]}
        />
      </TableToolbar>

      {/* Projects List Table */}
      <ProjectList projects={data.projects} />

      {/* Pagination */}
      <TablePagination total={data.total} page={data.page} pageSize={data.pageSize} />
    </div>
  );
}
