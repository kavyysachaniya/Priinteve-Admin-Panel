export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/tasks/task-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listTasks } from "@/lib/services/tasks";
import { requireAuth } from "@/lib/auth/session";
import { Plus, User, AtSign, CheckSquare } from "lucide-react";
import type { TaskStatus, TaskPriority } from "@prisma/client";

export const metadata = { title: "Tasks — Priinteve Business OS" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    filter?: string;
    page?: string;
  }>;
}) {
  const sessionUser = await requireAuth();
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const currentFilter = params.filter || "all";

  const data = await listTasks(
    {
      q: params.q,
      status: params.status as TaskStatus,
      priority: params.priority as TaskPriority,
      dueDate: params.dueDate,
      assignedToMe: currentFilter === "assigned",
      taggedMe: currentFilter === "tagged",
      page,
    },
    sessionUser
  );

  const isClient = sessionUser.role === "CLIENT";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isClient ? "My Project Tasks" : "Operational Tasks"}
        description={
          isClient
            ? "Tasks, requests, and milestones across your projects."
            : "To-dos, follow-ups, prepress checks, and delivery action items."
        }
        actions={
          <Button asChild size="sm">
            <Link href="/tasks/new">
              <Plus className="size-4 mr-1" /> New Task
            </Link>
          </Button>
        }
      />

      {/* Employee Quick Filters: All, Assigned to Me, Tagged Me (Spec 7) */}
      {!isClient && (
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <Button
            asChild
            size="sm"
            variant={currentFilter === "all" ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
          >
            <Link href="/tasks">
              <CheckSquare className="size-3.5" />
              All Visible Tasks
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            variant={currentFilter === "assigned" ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
          >
            <Link href="/tasks?filter=assigned">
              <User className="size-3.5" />
              Assigned to Me
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            variant={currentFilter === "tagged" ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
          >
            <Link href="/tasks?filter=tagged">
              <AtSign className="size-3.5" />
              Tagged Me
            </Link>
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <TableFilterSelect
          paramName="status"
          placeholder="All Statuses"
          options={[
            { label: "To Do", value: "TODO" },
            { label: "In Progress", value: "IN_PROGRESS" },
            { label: "Completed", value: "COMPLETED" },
            { label: "Cancelled", value: "CANCELLED" },
          ]}
        />

        <TableFilterSelect
          paramName="priority"
          placeholder="All Priorities"
          options={[
            { label: "Low", value: "LOW" },
            { label: "Medium", value: "MEDIUM" },
            { label: "High", value: "HIGH" },
            { label: "Urgent", value: "URGENT" },
          ]}
        />
      </div>

      <TaskList tasks={data.tasks} />
      <TablePagination total={data.total} page={data.page} pageSize={data.pageSize} />
    </div>
  );
}
