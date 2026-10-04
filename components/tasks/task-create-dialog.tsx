"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaskPriority } from "@prisma/client";

interface AssignableUser {
  id: string;
  name: string;
  role: "ADMIN" | "EMPLOYEE" | "CLIENT";
}

const ROLE_LABEL: Record<AssignableUser["role"], string> = {
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
  CLIENT: "Client",
};

export function TaskCreateDialog({
  projects,
  fixedProjectId,
}: {
  projects: Array<{ id: string; name: string }>;
  fixedProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [projectId, setProjectId] = useState(fixedProjectId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assigneeId, setAssigneeId] = useState("none");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<{ projectId: string; users: AssignableUser[] } | null>(null);
  const users = loaded && loaded.projectId === projectId ? loaded.users : [];
  const loadingUsers = open && Boolean(projectId) && loaded?.projectId !== projectId;

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/assignable-users`)
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .catch(() => ({ users: [] }))
      .then((data) => {
        if (!cancelled) setLoaded({ projectId, users: data.users ?? [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const reset = () => {
    setProjectId(fixedProjectId ?? (projects.length === 1 ? projects[0].id : ""));
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDueDate("");
    setDueTime("");
    setAssigneeId("none");
    setMentionIds([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) reset();
    setOpen(next);
  };

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    setAssigneeId("none");
    setMentionIds([]);
  };

  const toggleMention = (id: string) =>
    setMentionIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      toast.error("Choose a project for this task");
      return;
    }
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          dueTime: dueDate && dueTime ? dueTime : undefined,
          assignedToId: assigneeId !== "none" ? assigneeId : undefined,
          assigneeId: assigneeId !== "none" ? assigneeId : undefined,
          mentionUserIds: mentionIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create task");
      }
      toast.success("Task created");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Add a task, set a deadline, and assign it to an admin, employee or client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-3 text-xs">
            {!fixedProjectId && (
              <div className="space-y-1.5">
                <Label htmlFor="task-project">Project *</Label>
                <Select value={projectId} onValueChange={handleProjectChange}>
                  <SelectTrigger id="task-project" className="h-9">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger id="task-priority" className="h-9">
                    <SelectValue />
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
                <Label htmlFor="task-due-date">Deadline</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  className="h-9"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due-time">Time</Label>
                <Input
                  id="task-due-time"
                  type="time"
                  className="h-9"
                  value={dueTime}
                  disabled={!dueDate}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Assign To</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId} disabled={!projectId}>
                <SelectTrigger id="task-assignee" className="h-9">
                  <SelectValue placeholder={projectId ? "Select assignee" : "Choose a project first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({ROLE_LABEL[u.role]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingUsers && <p className="text-[11px] text-muted-foreground italic">Loading people…</p>}
            </div>

            {users.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <Label className="block">Tag People (@mentions)</Label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {users.map((u) => {
                    const selected = mentionIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleMention(u.id)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <AtSign className="size-3" />
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
