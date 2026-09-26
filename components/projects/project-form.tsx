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
import { CustomerCombobox, type ComboboxCustomer } from "@/components/shared/customer-combobox";
import { projectFormSchema, projectFormDefaults, type ProjectFormValues } from "@/lib/validations/project";
import { createProjectAction, updateProjectAction } from "@/lib/actions/projects";
import type { ProjectPriority, ProjectStatus } from "@prisma/client";

interface AssignableUser {
  id: string;
  name: string;
  email?: string;
}

export function ProjectForm({
  projectId,
  defaultValues,
  customers = [],
  users = [],
}: {
  projectId?: string;
  defaultValues?: Partial<ProjectFormValues>;
  customers?: ComboboxCustomer[];
  users?: AssignableUser[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(projectId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormValues>,
    defaultValues: projectFormDefaults(defaultValues),
  });

  const status = watch("status");
  const priority = watch("priority");
  const customerId = watch("customerId");
  const assignedToId = watch("assignedToId");

  async function onSubmit(values: ProjectFormValues) {
    if (submitting) return;
    setSubmitting(true);

    try {
      const result = isEdit
        ? await updateProjectAction(projectId!, values)
        : await createProjectAction(values);

      if (!result.success) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setError(field as keyof ProjectFormValues, { message: String(message) });
          }
        }
        return;
      }

      toast.success(result.message || (isEdit ? "Project updated successfully" : "Project created successfully"));
      if (result.id) {
        router.push(`/projects/${result.id}`);
      } else {
        router.push("/projects");
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Project Overview */}
      <FormSection title="Project Details" description="Core project specifications, assignment, and status.">
        <Field label="Project Name" required error={errors.name?.message} className="sm:col-span-2">
          <Input placeholder="e.g. Website Redesign & Brand Assets" {...register("name")} disabled={submitting} />
        </Field>

        <Field label="Project Description" required error={errors.description?.message} className="sm:col-span-2">
          <Textarea
            rows={3}
            placeholder="Detailed scope, objectives, and deliverables for this project…"
            {...register("description")}
            disabled={submitting}
          />
        </Field>

        <Field label="Status" required error={errors.status?.message}>
          <Select
            value={status}
            onValueChange={(v) => setValue("status", v as ProjectStatus, { shouldValidate: true })}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="ON_HOLD">On Hold</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Priority" required error={errors.priority?.message}>
          <Select
            value={priority}
            onValueChange={(v) => setValue("priority", v as ProjectPriority, { shouldValidate: true })}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

      {/* Relations & Assignment */}
      <FormSection title="Client & Team Assignment" description="Associate project with client and team member.">
        <Field label="Client / Customer" error={errors.customerId?.message}>
          <CustomerCombobox
            customers={customers}
            value={customerId || ""}
            onChange={(selectedId) => setValue("customerId", selectedId, { shouldValidate: true })}
          />
        </Field>

        <Field label="Assigned Team Member" error={errors.assignedToId?.message}>
          <Select
            value={assignedToId || "UNASSIGNED"}
            onValueChange={(v) => setValue("assignedToId", v === "UNASSIGNED" ? "" : v, { shouldValidate: true })}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} {u.email ? `(${u.email})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

      {/* Schedule & Notes */}
      <FormSection title="Schedule & Notes" description="Set milestone dates and administrative notes.">
        <Field label="Start Date" error={errors.startDate?.message}>
          <Input type="date" {...register("startDate")} disabled={submitting} />
        </Field>

        <Field label="Due Date" error={errors.dueDate?.message}>
          <Input type="date" {...register("dueDate")} disabled={submitting} />
        </Field>

        <Field label="Internal Notes & Instructions" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea
            rows={3}
            placeholder="Special considerations, billing notes, or links to external assets…"
            {...register("notes")}
            disabled={submitting}
          />
        </Field>
      </FormSection>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Project Changes" : "+ Create Project"}
        </Button>
      </div>
    </form>
  );
}
