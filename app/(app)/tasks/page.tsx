import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/tasks/task-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listTasks } from "@/lib/services/tasks";
import { Plus } from "lucide-react";
import type { TaskStatus, TaskPriority } from "@prisma/client";

export const metadata = { title: "Tasks — Priinteve Business OS" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; dueDate?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const data = await listTasks({
    q: params.q,
    status: params.status as TaskStatus,
    priority: params.priority as TaskPriority,
    dueDate: params.dueDate,
    page,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Tasks"
        description="To-dos, follow-ups, prepress checks, and delivery action items."
        actions={
          <Button asChild size="sm">
            <Link href="/tasks/new">
              <Plus className="size-4 mr-1" /> New Task
            </Link>
          </Button>
        }
      />

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
      </div>

      <TaskList tasks={data.tasks} />
      <TablePagination total={data.total} page={data.page} pageSize={data.pageSize} />
    </div>
  );
}
