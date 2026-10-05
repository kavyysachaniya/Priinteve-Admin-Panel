"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection } from "@/components/shared/field";
import { LinesInput } from "@/components/companion/lines-input";
import { companionSettingsFormSchema, type CompanionSettingsFormValues } from "@/lib/validations/companion";
import { updateCompanionSettingsAction } from "@/lib/actions/companion";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Allowed = { websites: boolean; slack: boolean; gmail: boolean };

/** First error message inside an array field (row-level errors live on nested paths). */
function arrayError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as { message?: string; root?: { message?: string } } & Record<string, unknown>;
  if (e.message) return e.message;
  if (e.root?.message) return e.root.message;
  for (const value of Object.values(e)) {
    if (value && typeof value === "object") {
      for (const inner of Object.values(value as Record<string, { message?: string }>)) {
        if (inner?.message) return inner.message;
      }
    }
  }
  return undefined;
}

export function CompanionSettingsForm({
  defaultValues,
  allowed,
  isAdmin,
  slackConfigured,
}: {
  defaultValues: CompanionSettingsFormValues;
  allowed: Allowed;
  isAdmin: boolean;
  slackConfigured: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    watch,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CompanionSettingsFormValues>({
    resolver: zodResolver(companionSettingsFormSchema) as Resolver<CompanionSettingsFormValues>,
    defaultValues,
  });

  const reminderEnabled = watch("reminderEnabled");
  const websites = useFieldArray({ control, name: "websites" });
  const slackChannels = useFieldArray({ control, name: "slackChannels" });

  async function onSubmit(values: CompanionSettingsFormValues) {
    setSubmitting(true);
    const result = await updateCompanionSettingsAction(values);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof CompanionSettingsFormValues, { message });
      }
      return;
    }
    toast.success("Companion settings saved. They apply on the next briefing.");
    router.refresh();
  }

  function onInvalid(formErrors: FieldErrors<CompanionSettingsFormValues>) {
    toast.error(`Please fix the highlighted fields (${Object.keys(formErrors).length}).`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5">
      <FormSection title="Mascot and greeting" description="How your companion greets you each morning">
        <Field label="Mascot name" htmlFor="mascotName" required error={errors.mascotName?.message}>
          <Input id="mascotName" {...register("mascotName")} />
        </Field>
        <Field label="Your name" htmlFor="ownerName" required error={errors.ownerName?.message}>
          <Input id="ownerName" {...register("ownerName")} />
        </Field>
        <Field
          label="Greeting"
          htmlFor="greeting"
          required
          error={errors.greeting?.message}
          hint={'"Good morning" switches to afternoon or evening automatically'}
        >
          <Input id="greeting" {...register("greeting")} />
        </Field>
        <Field
          label="Time zone"
          htmlFor="timezone"
          required
          error={errors.timezone?.message}
          hint="Decides what counts as today, yesterday and tomorrow"
        >
          <Input id="timezone" placeholder="Asia/Kolkata" {...register("timezone")} />
        </Field>
      </FormSection>

      <FormSection title="Morning checklist and tasks" description="Checklist items show as to-dos at the top of the Today section">
        <Field label="Checklist" htmlFor="checklist" error={arrayError(errors.checklist)} hint="One item per line" className="sm:col-span-2">
          <Controller
            control={control}
            name="checklist"
            render={({ field }) => (
              <LinesInput
                id="checklist"
                value={field.value}
                onChange={field.onChange}
                placeholder={"Check overnight orders\nReply to WhatsApp enquiries"}
              />
            )}
          />
        </Field>
        <Field
          label="Tasks to include"
          error={errors.plannerSource?.message}
          hint={isAdmin ? "Overdue, today's and tomorrow's open tasks from the planner" : "Tasks assigned to you or that tag you"}
        >
          <Controller
            control={control}
            name="plannerSource"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!isAdmin}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MY_TASKS">My tasks</SelectItem>
                  {isAdmin && <SelectItem value="ALL_TASKS">All team tasks</SelectItem>}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Project reminders"
        description="While the app is running, it checks in every 30 minutes during your work hours: is a project timer running, and which tasks are overdue or due today, grouped by project."
      >
        <div className="flex items-center gap-3 sm:col-span-2">
          <Controller
            control={control}
            name="reminderEnabled"
            render={({ field }) => (
              <Switch id="reminderEnabled" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <label htmlFor="reminderEnabled" className="text-sm font-medium">
            Remind me every 30 minutes
          </label>
        </div>
        <Field label="Work day starts" htmlFor="reminderStart" error={errors.reminderStart?.message}>
          <Input id="reminderStart" type="time" disabled={!reminderEnabled} {...register("reminderStart")} />
        </Field>
        <Field label="Work day ends" htmlFor="reminderEnd" error={errors.reminderEnd?.message} hint="Times use your computer's clock">
          <Input id="reminderEnd" type="time" disabled={!reminderEnabled} {...register("reminderEnd")} />
        </Field>
        <Field label="Days" error={arrayError(errors.reminderDays)} className="sm:col-span-2">
          <Controller
            control={control}
            name="reminderDays"
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {WEEKDAYS.map((label, day) => {
                  const on = field.value.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={!reminderEnabled}
                      aria-pressed={on}
                      onClick={() => field.onChange(on ? field.value.filter((d) => d !== day) : [...field.value, day].sort())}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </Field>
      </FormSection>

      {allowed.websites && (
        <FormSection title="Websites to monitor" description="Checked each morning with an 8-second limit. Slower than 3 seconds shows as slow.">
          <div className="space-y-2 sm:col-span-2">
            {websites.fields.map((row, index) => (
              <div key={row.id} className="flex items-start gap-2">
                <Input aria-label="Site name" placeholder="Main site" className="w-40" {...register(`websites.${index}.label`)} />
                <Input aria-label="Address" placeholder="https://priinteve.com" {...register(`websites.${index}.url`)} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove site" onClick={() => websites.remove(index)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {arrayError(errors.websites) && <p className="text-xs text-destructive">{arrayError(errors.websites)}</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => websites.append({ label: "", url: "https://" })}>
              <Plus className="size-4" /> Add website
            </Button>
          </div>
        </FormSection>
      )}

      {allowed.slack && (
        <FormSection
          title="Slack"
          description={
            slackConfigured
              ? "Counts messages from the last 24 hours that contain an error keyword. Invite the Priinteve bot to each channel."
              : "Slack isn't connected on the server yet (SLACK_BOT_TOKEN). You can still save channels."
          }
        >
          <div className="space-y-2 sm:col-span-2">
            {slackChannels.fields.map((row, index) => (
              <div key={row.id} className="flex items-start gap-2">
                <Input aria-label="Channel name" placeholder="#alerts" className="w-40" {...register(`slackChannels.${index}.label`)} />
                <Input aria-label="Channel ID" placeholder="C0123456789" {...register(`slackChannels.${index}.id`)} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove channel" onClick={() => slackChannels.remove(index)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {arrayError(errors.slackChannels) && <p className="text-xs text-destructive">{arrayError(errors.slackChannels)}</p>}
            <p className="text-xs text-muted-foreground">
              Find the channel ID in Slack: open the channel, click its name, and copy the ID at the bottom.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => slackChannels.append({ label: "", id: "" })}>
              <Plus className="size-4" /> Add channel
            </Button>
          </div>
          <Field label="Error keywords" htmlFor="slackKeywords" error={arrayError(errors.slackKeywords)} hint="Comma or line separated" className="sm:col-span-2">
            <Controller
              control={control}
              name="slackKeywords"
              render={({ field }) => (
                <LinesInput id="slackKeywords" rows={2} splitCommas value={field.value} onChange={field.onChange} placeholder="error, failed, exception" />
              )}
            />
          </Field>
        </FormSection>
      )}

      {allowed.gmail && (
        <FormSection title="Email ranking" description="Decides which of yesterday's emails count as important. Newsletters and notifications always rank last.">
          <Field label="VIP senders" htmlFor="vipSenders" error={arrayError(errors.vipSenders)} hint="Addresses or whole domains (@client.com), one per line">
            <Controller
              control={control}
              name="vipSenders"
              render={({ field }) => (
                <LinesInput id="vipSenders" value={field.value} onChange={field.onChange} placeholder={"boss@client.com\n@bigcustomer.in"} />
              )}
            />
          </Field>
          <Field label="Urgent keywords" htmlFor="urgentKeywords" error={arrayError(errors.urgentKeywords)} hint="Matched in the subject line">
            <Controller
              control={control}
              name="urgentKeywords"
              render={({ field }) => (
                <LinesInput id="urgentKeywords" splitCommas value={field.value} onChange={field.onChange} placeholder="payment, invoice, order, deadline" />
              )}
            />
          </Field>
        </FormSection>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save companion settings"}
        </Button>
      </div>
    </form>
  );
}
