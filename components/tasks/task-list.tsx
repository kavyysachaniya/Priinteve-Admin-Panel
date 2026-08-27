"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CheckSquare, Calendar } from "lucide-react";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleTaskStatusAction } from "@/lib/actions/tasks";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function TaskList({ tasks }: { tasks: any[] }) {
  const router = useRouter();

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground italic">
        No tasks found.
      </div>
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
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Task Title</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Related Entity</TableHead>
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
              <TableCell>
                <TaskPriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status} />
              </TableCell>
              <TableCell className="text-xs">
                {task.dueDate ? (
                  <span>{format(new Date(task.dueDate), "d MMM yyyy")} {task.dueTime ? `(${task.dueTime})` : ""}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {task.assignedTo ? task.assignedTo.name : "Unassigned"}
              </TableCell>
              <TableCell className="text-xs">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

