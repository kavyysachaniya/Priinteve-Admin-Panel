"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/field";
import type { ProjectOption } from "@/components/tasks/task-form";
import { deleteTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import { taskFormSchema, type TaskFormValues } from "@/lib/validations/task";
import { formatDateTime } from "@/lib/format";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export interface TaskWorkspaceInfo {
  customer: { id: string; name: string } | null;
  order: { id: string; number: string } | null;
  createdByName: string | null;
  createdAt: string;
  /** People already on the task who may not be in the project's assignee list. */
  extraPeople: Array<{ id: string; name: string }>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * The task page: every field edits in place and saves as soon as you leave it (text) or
 * change it (selects, dates). There is no separate edit page or modal. `aside` holds the
 * comments, attachments and activity rendered by the server page.
 */
export function TaskWorkspace({
  taskId,
  defaultValues,
  info,
  projects,
  canEdit,
  canDelete,
  aside,
}: {
  taskId: string;
  defaultValues: TaskFormValues;
  info: TaskWorkspaceInfo;
  projects: ProjectOption[];
  canEdit: boolean;
  canDelete: boolean;
  aside: React.ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TaskFormValues>(defaultValues);
  const savedRef = useRef<TaskFormValues>(defaultValues);
  const [state, setState] = useState<SaveState>("idle");

  const project = projects.find((p) => p.id === values.projectId);
  const people = new Map<string, string>();
  for (const e of project?.assignedEmployees ?? []) people.set(e.id, e.name);
  for (const e of info.extraPeople) if (!people.has(e.id)) people.set(e.id, e.name);
  const assigneeId = values.assigneeId || values.assignedToId || "";
  const mentions = values.mentionUserIds ?? [];

  /** Merge `patch` into the form, validate with the shared schema, and save if anything changed. */
  async function commit(patch: Partial<TaskFormValues> = {}) {
    const next = { ...values, ...patch };
    setValues(next);
    if (!canEdit) return;

    const parsed = taskFormSchema.safeParse(next);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the fields.");
      setValues(savedRef.current);
      return;
    }
    if (JSON.stringify(parsed.data) === JSON.stringify(savedRef.current)) return;

    setState("saving");
    const result = await updateTaskAction(taskId, parsed.data);
    if (!result.success) {
      toast.error(result.message);
      setValues(savedRef.current);
      setState("error");
      return;
    }
    savedRef.current = parsed.data;
    setState("saved");
    router.refresh();
  }

  const status = values.status;
  const disabled = !canEdit;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start gap-3 border-b pb-4">
        <div className="min-w-0 flex-1">
          <Input
            aria-label="Task title"
            value={values.title}
            disabled={disabled}
            maxLength={200}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-auto border-transparent bg-transparent px-1 py-1 text-2xl font-bold tracking-tight shadow-none hover:border-input focus-visible:border-input"
          />
          <p className="mt-1 px-1 text-xs text-muted-foreground">
            {info.createdByName ? `Created by ${info.createdByName} · ` : ""}
            {formatDateTime(info.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex min-w-16 items-center justify-end gap-1 text-xs text-muted-foreground" aria-live="polite">
            {state === "saving" && (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Saving…
              </>
            )}
            {state === "saved" && (
              <>
                <CheckCircle2 className="size-3.5 text-green-600" /> Saved
              </>
            )}
            {state === "error" && <span className="text-destructive">Not saved</span>}
          </span>
          {canEdit && (
            <Button
              size="sm"
              variant={status === "COMPLETED" ? "outline" : "default"}
              onClick={() => commit({ status: status === "COMPLETED" ? "TODO" : "COMPLETED" })}
            >
              <CheckCircle2 className="mr-1 size-3.5" />
              {status === "COMPLETED" ? "Mark Incomplete" : "Mark Complete"}
            </Button>
          )}
          {canDelete && (
            <ConfirmDialog
              title="Delete Task"
              description="Are you sure you want to delete this task? Its comments and files are deleted too."
              onConfirm={async () => {
                const res = await deleteTaskAction(taskId);
                if (res.success) router.push("/tasks");
                return res;
              }}
              trigger={
                <Button variant="destructive" size="sm" aria-label="Delete task">
                  <Trash2 className="size-3.5" />
                </Button>
              }
            />
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          You can read and comment on this task, but only its creator or the team can change it.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select value={status} disabled={disabled} onValueChange={(v) => commit({ status: v as TaskStatus })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Priority">
                <Select value={values.priority} disabled={disabled} onValueChange={(v) => commit({ priority: v as TaskPriority })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Project">
                <Select
                  value={values.projectId || ""}
                  disabled={disabled || projects.length === 0}
                  onValueChange={(v) => commit({ projectId: v, assigneeId: "", assignedToId: "", mentionUserIds: [] })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Assigned to">
                <Select
                  value={assigneeId || "unassigned"}
                  disabled={disabled || !values.projectId}
                  onValueChange={(v) => {
                    const id = v === "unassigned" ? "" : v;
                    commit({ assigneeId: id, assignedToId: id });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {[...people].map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Due date">
                <Input type="date" value={values.dueDate} disabled={disabled} onChange={(e) => commit({ dueDate: e.target.value })} />
              </Field>

              <Field label="Due time">
                <Input
                  type="time"
                  value={values.dueTime}
                  disabled={disabled}
                  onChange={(e) => setValues((v) => ({ ...v, dueTime: e.target.value }))}
                  onBlur={() => commit()}
                />
              </Field>

              <Field label="Reminder">
                <Input
                  type="datetime-local"
                  value={values.reminder}
                  disabled={disabled}
                  onChange={(e) => setValues((v) => ({ ...v, reminder: e.target.value }))}
                  onBlur={() => commit()}
                />
              </Field>

              <Field label="Tags" hint="Comma separated">
                <Input
                  value={values.tags}
                  disabled={disabled}
                  maxLength={200}
                  placeholder="e.g. proof, urgent-print"
                  onChange={(e) => setValues((v) => ({ ...v, tags: e.target.value }))}
                  onBlur={() => commit()}
                />
              </Field>

              <Field label="Description & checklist" className="sm:col-span-2">
                <Textarea
                  rows={6}
                  value={values.description}
                  disabled={disabled}
                  placeholder="Task instructions or checklist items…"
                  onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                  onBlur={() => commit()}
                />
              </Field>

              <Field label="Tagged people (@mentions)" className="sm:col-span-2">
                {people.size > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[...people].map(([id, name]) => {
                      const tagged = mentions.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={disabled}
                          onClick={() => commit({ mentionUserIds: tagged ? mentions.filter((m) => m !== id) : [...mentions, id] })}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
                            tagged
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <AtSign className="size-3" />
                          {name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="pt-1 text-xs italic text-muted-foreground">Choose a project to tag its team.</p>
                )}
              </Field>
            </CardContent>
          </Card>

          {(info.customer || info.order) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Linked records</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {info.customer && (
                  <div>
                    <span className="text-muted-foreground">Customer:</span>{" "}
                    <Link href={`/customers/${info.customer.id}`} className="font-semibold text-primary hover:underline">
                      {info.customer.name}
                    </Link>
                  </div>
                )}
                {info.order && (
                  <div>
                    <span className="text-muted-foreground">Order:</span>{" "}
                    <Link href={`/orders/${info.order.id}`} className="font-mono font-semibold text-primary hover:underline">
                      {info.order.number}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">{aside}</div>
      </div>
    </div>
  );
}
