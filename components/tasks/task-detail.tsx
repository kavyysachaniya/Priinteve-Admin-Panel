"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CheckSquare, Calendar, User, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { toggleTaskStatusAction, deleteTaskAction } from "@/lib/actions/tasks";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function TaskDetail({ task }: { task: any }) {
  const router = useRouter();

  const handleToggleTask = async () => {
    const res = await toggleTaskStatusAction(task.id);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{task.title}</h1>
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Due Date: {task.dueDate ? format(new Date(task.dueDate), "PPP") : "No due date"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleToggleTask} variant={task.status === "COMPLETED" ? "outline" : "default"}>
            <CheckCircle2 className="size-3.5 mr-1" />
            {task.status === "COMPLETED" ? "Mark Incomplete" : "Mark Complete"}
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link href={`/tasks/${task.id}/edit`}>
              <Edit className="size-3.5 mr-1" /> Edit
            </Link>
          </Button>

          <ConfirmDialog
            title="Delete Task"
            description="Are you sure you want to delete this task?"
            onConfirm={async () => {
              const res = await deleteTaskAction(task.id);
              if (res.success) router.push("/tasks");
              return res;
            }}
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-3.5" />
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Task Description</CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            {task.description ? (
              <p className="whitespace-pre-wrap leading-relaxed text-foreground">{task.description}</p>
            ) : (
              <p className="text-muted-foreground italic">No description added.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Associations & Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div>
              <span className="text-muted-foreground">Assigned To:</span>{" "}
              <span className="font-semibold text-foreground">{task.assignedTo ? task.assignedTo.name : "Unassigned"}</span>
            </div>
            {task.customer && (
              <div>
                <span className="text-muted-foreground">Customer:</span>{" "}
                <Link href={`/customers/${task.customer.id}`} className="font-semibold text-primary hover:underline">
                  {task.customer.name}
                </Link>
              </div>
            )}
            {task.order && (
              <div>
                <span className="text-muted-foreground">Order:</span>{" "}
                <Link href={`/orders/${task.order.id}`} className="font-semibold text-primary hover:underline font-mono">
                  {task.order.number}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

