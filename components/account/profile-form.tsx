"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormSection } from "@/components/shared/field";
import { accountNameSchema, type AccountNameValues } from "@/lib/validations/account";
import { updateAccountNameAction } from "@/lib/actions/account";

export function ProfileForm({ defaultName, email, roleLabel }: { defaultName: string; email: string; roleLabel: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<AccountNameValues>({
    resolver: zodResolver(accountNameSchema) as Resolver<AccountNameValues>,
    defaultValues: { name: defaultName },
  });

  async function onSubmit(values: AccountNameValues) {
    setSaving(true);
    const result = await updateAccountNameAction(values);
    setSaving(false);
    if (!result.success) {
      toast.error(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof AccountNameValues, { message });
      }
      return;
    }
    // Ask Auth.js to re-read the name so the top bar updates without signing out.
    await update();
    toast.success("Your name was updated");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormSection title="Profile" description="How your name appears on tasks, comments and timers">
        <Field label="Name" htmlFor="name" required error={errors.name?.message}>
          <Input id="name" autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" hint="Sign-in address. Ask an admin to change it.">
          <Input id="email" value={email} readOnly disabled />
        </Field>
        <Field label="Role" htmlFor="role">
          <Input id="role" value={roleLabel} readOnly disabled />
        </Field>
      </FormSection>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !isDirty}>
          {saving ? "Saving…" : "Save name"}
        </Button>
      </div>
    </form>
  );
}
