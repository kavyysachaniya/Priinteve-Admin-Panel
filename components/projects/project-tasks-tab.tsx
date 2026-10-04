"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckSquare,
  Plus,
  Calendar,
  User as UserIcon,
  AtSign,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/time-format";
import { toggleTaskStatusAction, deleteTaskAction } from "@/lib/actions/tasks";
import type { TaskPriority, TaskStatus } from "@prisma/client";

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | string | null;
  createdById?: string | null;
  createdByRole?: string | null;
  createdBy?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  mentions?: Array<{
    id: string;
    employee: { id: string; name: string; email: string };
  }>;
}

interface AssignedEmployee {
  id: string;
  name: string;
  email: string;
}

export function ProjectTasksTab({
  projectId,
  tasks,
  assignedEmployees,
  currentUserId,
  currentUserRole,
}: {
  projectId: string;
  tasks: TaskItem[];
  assignedEmployees: AssignedEmployee[];
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);

  const handleOpenCreate = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDueDate("");
    setAssigneeId("none");
    setSelectedMentionIds([]);
    setCreateOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          assignedToId: assigneeId !== "none" ? assigneeId : undefined,
          assigneeId: assigneeId !== "none" ? assigneeId : undefined,
          mentionUserIds: selectedMentionIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create task");
      }

      toast.success("Task created successfully");
      setCreateOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (task: TaskItem) => {
    if (togglingId) return;

    if (currentUserRole === "CLIENT" && task.createdById !== currentUserId) {
      toast.error("Clients cannot change the status of team-owned tasks.");
      return;
    }

    setTogglingId(task.id);
    try {
      const res = await toggleTaskStatusAction(task.id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteTask = async (task: TaskItem) => {
    if (!confirm(`Are you sure you want to delete task "${task.title}"?`)) return;

    try {
      const res = await deleteTaskAction(task.id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task");
    }
  };

  const toggleMention = (id: string) => {
    setSelectedMentionIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const canEditTask = (task: TaskItem) => {
    if (currentUserRole === "ADMIN") return true;
    if (currentUserRole === "CLIENT") return task.createdById === currentUserId;
    return true;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Project Tasks</h2>
          <p className="text-xs text-muted-foreground">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} tracked for this project.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={handleOpenCreate}>
              <Plus className="size-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleCreateTask}>
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
                <DialogDescription>
                  Add a task or request to this project. You can assign or tag team members.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 py-3 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="task-title">Title *</Label>
                  <Input
                    id="task-title"
                    placeholder="E.g. Review packaging mockups"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="task-desc">Description</Label>
                  <Textarea
                    id="task-desc"
                    placeholder="Details, feedback, or instructions…"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="task-priority">Priority</Label>
                    <Select
                      value={priority}
                      onValueChange={(val) => setPriority(val as TaskPriority)}
                    >
                      <SelectTrigger id="task-priority" className="h-9">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="task-due-date">Due Date</Label>
                    <Input
                      id="task-due-date"
                      type="date"
                      className="h-9"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="task-assignee">Assign To</Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger id="task-assignee" className="h-9">
                      <SelectValue placeholder="Select assigned employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {assignedEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignedEmployees.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">
                      No employees are currently assigned to this project.
                    </p>
                  )}
                </div>

                {assignedEmployees.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="block">Tag Team Members (@mentions)</Label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {assignedEmployees.map((emp) => {
                        const isSelected = selectedMentionIds.includes(emp.id);
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => toggleMention(emp.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            <AtSign className="size-3" />
                            {emp.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : null}
                  Create Task
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckSquare className="size-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="font-semibold text-foreground text-sm mb-1">No Tasks Yet</p>
            <p className="text-xs">
              Click &quot;New Task&quot; above to create the first task for this project.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            const canToggle =
              currentUserRole !== "CLIENT" || task.createdById === currentUserId;
            const canEdit = canEditTask(task);

            return (
              <div
                key={task.id}
                className={`flex items-start justify-between gap-3 p-3.5 rounded-lg border bg-card transition ${
                  isCompleted ? "opacity-75 bg-muted/20" : "hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(task)}
                    disabled={togglingId === task.id || !canToggle}
                    className="mt-0.5 text-muted-foreground hover:text-primary transition disabled:opacity-50"
                    title={
                      !canToggle
                        ? "Clients cannot change the status of team-owned tasks"
                        : isCompleted
                        ? "Mark incomplete"
                        : "Mark complete"
                    }
                  >
                    {togglingId === task.id ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 fill-emerald-500/20" />
                    ) : (
                      <Circle className="size-4" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-medium text-foreground ${
                          isCompleted ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.title}
                      </span>

                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          task.priority === "URGENT"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : task.priority === "HIGH"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {task.priority}
                      </span>

                      {task.createdByRole === "CLIENT" && (
                        <span className="text-[10px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded">
                          Client Request
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}

                      {task.assignedTo && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <UserIcon className="size-3 text-muted-foreground" />
                          {task.assignedTo.name}
                        </span>
                      )}

                      {task.mentions && task.mentions.length > 0 && (
                        <div className="flex items-center gap-1">
                          <AtSign className="size-3 text-primary" />
                          <span className="text-primary font-medium">
                            {task.mentions.map((m) => m.employee.name).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive gap-2 text-xs"
                        onClick={() => handleDeleteTask(task)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
