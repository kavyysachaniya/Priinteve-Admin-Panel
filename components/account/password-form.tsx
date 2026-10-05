"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormSection } from "@/components/shared/field";
import { accountPasswordSchema, type AccountPasswordValues } from "@/lib/validations/account";
import { changeAccountPasswordAction } from "@/lib/actions/account";

const EMPTY: AccountPasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function PasswordForm() {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AccountPasswordValues>({
    resolver: zodResolver(accountPasswordSchema) as Resolver<AccountPasswordValues>,
    defaultValues: EMPTY,
  });

  async function onSubmit(values: AccountPasswordValues) {
    setSaving(true);
    const result = await changeAccountPasswordAction(values);
    setSaving(false);
    if (!result.success) {
      toast.error(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof AccountPasswordValues, { message });
      }
      // The server reports a wrong current password as a message, not a field error.
      if (/current password/i.test(result.message)) setError("currentPassword", { message: result.message });
      return;
    }
    reset(EMPTY);
    toast.success("Password changed. Use it next time you sign in.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
      <FormSection title="Change password" description="Enter your current password, then choose a new one (at least 8 characters)">
        <Field label="Current password" htmlFor="currentPassword" required error={errors.currentPassword?.message} className="sm:col-span-2">
          <Input id="currentPassword" type="password" autoComplete="current-password" {...register("currentPassword")} />
        </Field>
        <Field label="New password" htmlFor="newPassword" required error={errors.newPassword?.message}>
          <Input id="newPassword" type="password" autoComplete="new-password" {...register("newPassword")} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
        </Field>
      </FormSection>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
