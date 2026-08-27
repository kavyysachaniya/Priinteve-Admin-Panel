"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection } from "@/components/shared/field";
import { taskFormSchema, taskFormDefaults, type TaskFormValues } from "@/lib/validations/task";
import { createTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export function TaskForm({
  taskId,
  defaultValues,
}: {
  taskId?: string;
  defaultValues?: Partial<TaskFormValues>;
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
      <FormSection title="Task Details">
        <Field label="Task Title" required error={errors.title?.message} className="sm:col-span-2">
          <Input placeholder="e.g. Call customer for artwork approval" {...register("title")} />
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

