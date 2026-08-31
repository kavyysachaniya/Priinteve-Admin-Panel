"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CheckSquare, Eye, Pencil } from "lucide-react";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { QuickAction, RowActions, RowActionsBar } from "@/components/shared/row-actions";
import { DeleteTaskItem } from "@/components/tasks/delete-task-item";
import { toggleTaskStatusAction } from "@/lib/actions/tasks";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { TaskListItem } from "@/lib/services/tasks";

export function TaskList({ tasks }: { tasks: TaskListItem[] }) {
  const router = useRouter();

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No tasks found"
        description="Create to-dos, follow-ups, and delivery action items to track them here."
      />
    );
  }

  const handleToggleTask = async (id: string) => {
    const res = await toggleTaskStatusAction(id);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Task Title</TableHead>
            <TableHead className="hidden md:table-cell">Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Due Date</TableHead>
            <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
            <TableHead className="hidden xl:table-cell">Related Entity</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={task.status === "COMPLETED"}
                  onChange={() => handleToggleTask(task.id)}
                  className="size-4 rounded border-input cursor-pointer"
                />
              </TableCell>
              <TableCell className="text-xs font-semibold">
                <Link
                  href={`/tasks/${task.id}`}
                  className={`hover:underline ${task.status === "COMPLETED" ? "line-through text-muted-foreground" : "text-foreground"}`}
                >
                  {task.title}
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <TaskPriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status} />
              </TableCell>
              <TableCell className="hidden text-xs md:table-cell">
                {task.dueDate ? (
                  <span>{format(new Date(task.dueDate), "d MMM yyyy")} {task.dueTime ? `(${task.dueTime})` : ""}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                {task.assignedTo ? task.assignedTo.name : "Unassigned"}
              </TableCell>
              <TableCell className="hidden text-xs xl:table-cell">
                {task.customer && (
                  <Link href={`/customers/${task.customer.id}`} className="text-primary hover:underline font-medium">
                    {task.customer.name}
                  </Link>
                )}
                {task.order && (
                  <Link href={`/orders/${task.order.id}`} className="text-primary hover:underline font-mono ml-2">
                    {task.order.number}
                  </Link>
                )}
              </TableCell>
              <TableCell>
                <RowActionsBar>
                  <QuickAction icon={Eye} label="View" href={`/tasks/${task.id}`} />
                  <QuickAction icon={Pencil} label="Edit" href={`/tasks/${task.id}/edit`} />
                  <RowActions>
                    <DeleteTaskItem taskId={task.id} taskTitle={task.title} />
                  </RowActions>
                </RowActionsBar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
