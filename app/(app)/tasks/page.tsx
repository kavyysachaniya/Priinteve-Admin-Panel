export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/tasks/task-list";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listTasks, listTasksForBoard } from "@/lib/services/tasks";
import { listProjects } from "@/lib/services/projects";
import { requireAuth } from "@/lib/auth/session";
import { Plus, User, AtSign, CheckSquare, LayoutGrid, List } from "lucide-react";
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
    view?: string;
    page?: string;
  }>;
}) {
  const sessionUser = await requireAuth();
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const currentFilter = params.filter || "all";
  const isBoard = params.view !== "list";

  const baseParams = {
    q: params.q,
    priority: params.priority as TaskPriority,
    dueDate: params.dueDate,
    assignedToMe: currentFilter === "assigned",
    taggedMe: currentFilter === "tagged",
  };

  const [boardTasks, listData, projectsData] = await Promise.all([
    isBoard ? listTasksForBoard(baseParams, sessionUser) : Promise.resolve([]),
    isBoard ? Promise.resolve(null) : listTasks({ ...baseParams, status: params.status as TaskStatus, page }, sessionUser),
    isBoard ? listProjects({ pageSize: 100 }, sessionUser) : Promise.resolve(null),
  ]);
  const projects = (projectsData?.projects ?? []).map((p) => ({ id: p.id, name: p.name }));

  const viewHref = (view: "board" | "list") =>
    `/tasks?view=${view}${currentFilter !== "all" ? `&filter=${currentFilter}` : ""}`;
  const filterHref = (filter: string) =>
    `/tasks?view=${isBoard ? "board" : "list"}${filter !== "all" ? `&filter=${filter}` : ""}`;

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
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              <Button asChild size="sm" variant={isBoard ? "default" : "ghost"} className="h-7 gap-1.5 text-xs">
                <Link href={viewHref("board")}>
                  <LayoutGrid className="size-3.5" /> Board
                </Link>
              </Button>
              <Button asChild size="sm" variant={!isBoard ? "default" : "ghost"} className="h-7 gap-1.5 text-xs">
                <Link href={viewHref("list")}>
                  <List className="size-3.5" /> List
                </Link>
              </Button>
            </div>
            {isBoard ? (
              <TaskCreateDialog projects={projects} />
            ) : (
              <Button asChild size="sm">
                <Link href="/tasks/new">
                  <Plus className="size-4 mr-1" /> New Task
                </Link>
              </Button>
            )}
          </div>
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
            <Link href={filterHref("all")}>
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
            <Link href={filterHref("assigned")}>
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
            <Link href={filterHref("tagged")}>
              <AtSign className="size-3.5" />
              Tagged Me
            </Link>
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {!isBoard && (
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
        )}

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

      {isBoard ? (
        <TaskBoard tasks={boardTasks} viewer={{ id: sessionUser.id, role: sessionUser.role }} />
      ) : (
        listData && (
          <>
            <TaskList tasks={listData.tasks} />
            <TablePagination total={listData.total} page={listData.page} pageSize={listData.pageSize} />
          </>
        )
      )}
    </div>
  );
}
