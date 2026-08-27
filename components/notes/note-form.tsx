"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormSection } from "@/components/shared/field";
import { CustomerCombobox, type ComboboxCustomer } from "@/components/shared/customer-combobox";
import { noteFormSchema, noteFormDefaults, type NoteFormValues } from "@/lib/validations/note";
import { createNoteAction, updateNoteAction } from "@/lib/actions/notes";

export function NoteForm({
  noteId,
  defaultValues,
  customers = [],
}: {
  noteId?: string;
  defaultValues?: Partial<NoteFormValues>;
  customers?: ComboboxCustomer[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(noteId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema) as Resolver<NoteFormValues>,
    defaultValues: noteFormDefaults(defaultValues),
  });

  const customerId = watch("customerId");
  const pinned = watch("pinned");

  async function onSubmit(values: NoteFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateNoteAction(noteId!, values)
      : await createNoteAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof NoteFormValues, { message: String(message) });
        }
      }
      return;
    }

    toast.success(isEdit ? "Note updated successfully" : "Note created successfully");
    if (result.id) router.push(`/notes/${result.id}`);
    else router.push("/notes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Note Content">
        <Field label="Note Title" required error={errors.title?.message} className="sm:col-span-2">
          <Input placeholder="Title or topic..." {...register("title")} />
        </Field>

        <Field label="Content" required error={errors.content?.message} className="sm:col-span-2">
          <Textarea rows={6} placeholder="Type operational note or details..." {...register("content")} />
        </Field>

        <Field label="Tags" hint="Comma separated tags e.g. Urgent, Paper Stock, VIP" error={errors.tags?.message}>
          <Input placeholder="VIP, Paper Stock" {...register("tags")} />
        </Field>

        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id="pinned"
            checked={pinned}
            onCheckedChange={(checked) => setValue("pinned", Boolean(checked))}
          />
          <label htmlFor="pinned" className="text-xs font-semibold cursor-pointer">
            Pin note to top of workspace
          </label>
        </div>
      </FormSection>

      <FormSection title="Links & Context">
        <Field label="Attach to Customer" error={errors.customerId?.message}>
          <CustomerCombobox
            customers={customers}
            value={customerId}
            onChange={(id) => setValue("customerId", id, { shouldValidate: true })}
          />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Note"}
        </Button>
      </div>
    </form>
  );
}
