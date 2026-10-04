"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AtSign, FolderKanban, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormSection } from "@/components/shared/field";
import { taskFormSchema, taskFormDefaults, type TaskFormValues } from "@/lib/validations/task";
import { createTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export interface ProjectOption {
  id: string;
  name: string;
  assignedEmployees: Array<{ id: string; name: string; email: string }>;
}

export function TaskForm({
  taskId,
  defaultValues,
  projects = [],
}: {
  taskId?: string;
  defaultValues?: Partial<TaskFormValues>;
  projects?: ProjectOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(taskId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema) as Resolver<TaskFormValues>,
    defaultValues: taskFormDefaults(defaultValues),
  });

  const priority = watch("priority");
  const status = watch("status");
  const selectedProjectId = watch("projectId");
  const selectedAssigneeId = watch("assigneeId") || watch("assignedToId") || "";
  const mentionUserIds = watch("mentionUserIds") || [];

  // Find the selected project and its assigned employees
  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const availableAssignees = currentProject?.assignedEmployees || [];

  const handleToggleMention = (empId: string) => {
    const current = mentionUserIds || [];
    const next = current.includes(empId)
      ? current.filter((id) => id !== empId)
      : [...current, empId];
    setValue("mentionUserIds", next);
  };

  async function onSubmit(values: TaskFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateTaskAction(taskId!, values)
      : await createTaskAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof TaskFormValues, { message: String(message) });
        }
      }
      return;
    }

    toast.success(isEdit ? "Task updated successfully" : "Task created successfully");
    if (result.id) router.push(`/tasks/${result.id}`);
    else router.push("/tasks");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Task Scope & Project">
        {/* Project Selection (Spec 7: Project required) */}
        <Field
          label="Project"
          required
          error={errors.projectId?.message}
          className="sm:col-span-2"
        >
          <Select
            value={selectedProjectId || ""}
            onValueChange={(val) => {
              setValue("projectId", val);
              // Clear assignee and mentions if project changes
              setValue("assigneeId", "");
              setValue("assignedToId", "");
              setValue("mentionUserIds", []);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Assignee Selection limited to project employees */}
        <Field label="Assign To (Project Team)" className="sm:col-span-1">
          <Select
            value={selectedAssigneeId || "unassigned"}
            onValueChange={(val) => {
              const actual = val === "unassigned" ? "" : val;
              setValue("assigneeId", actual);
              setValue("assignedToId", actual);
            }}
            disabled={!selectedProjectId}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedProjectId ? "Unassigned" : "Choose project first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {availableAssignees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name} ({emp.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProjectId && availableAssignees.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic mt-1">
              No employees are currently assigned to this project.
            </p>
          )}
        </Field>

        {/* Tagged Mentions (@mentions) */}
        <Field label="Tag Team Members (@mentions)" className="sm:col-span-1">
          {selectedProjectId && availableAssignees.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {availableAssignees.map((emp) => {
                const isTagged = mentionUserIds.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleToggleMention(emp.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition ${
                      isTagged
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
          ) : (
            <p className="text-xs text-muted-foreground italic pt-2">
              {!selectedProjectId
                ? "Select a project to tag assigned employees."
                : "No assigned employees to tag."}
            </p>
          )}
        </Field>
      </FormSection>

      <FormSection title="Task Details">
        <Field label="Task Title" required error={errors.title?.message} className="sm:col-span-2">
          <Input placeholder="e.g. Review artwork & proof for client approval" {...register("title")} />
        </Field>

        <Field label="Priority" required>
          <Select value={priority} onValueChange={(v) => setValue("priority", v as TaskPriority)}>
            <SelectTrigger>
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

        <Field label="Status" required>
          <Select value={status} onValueChange={(v) => setValue("status", v as TaskStatus)}>
            <SelectTrigger>
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

        <Field label="Due Date" error={errors.dueDate?.message}>
          <Input type="date" {...register("dueDate")} />
        </Field>

        <Field label="Due Time" error={errors.dueTime?.message}>
          <Input type="time" {...register("dueTime")} />
        </Field>

        <Field label="Description & Checklist" className="sm:col-span-2" error={errors.description?.message}>
          <Textarea rows={3} placeholder="Task instructions or checklist items..." {...register("description")} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Task Changes" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
