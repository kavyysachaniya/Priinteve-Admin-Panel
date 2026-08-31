"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { CustomerCombobox, type ComboboxCustomer } from "@/components/shared/customer-combobox";
import {
  calendarEventFormSchema,
  calendarEventFormDefaults,
  type CalendarEventFormValues,
} from "@/lib/validations/calendar";
import { createCalendarEventAction, updateCalendarEventAction } from "@/lib/actions/calendar";

export interface CalendarEventEditTarget {
  id: string;
  title: string;
  description?: string | null;
  startDate: Date | string;
  startTime?: string | null;
  endDate?: Date | string | null;
  endTime?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  taskId?: string | null;
}

export function EventFormDialog({
  open,
  onOpenChange,
  customers,
  orders,
  tasks,
  event,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: ComboboxCustomer[];
  orders: Array<{ id: string; number: string }>;
  tasks: Array<{ id: string; title: string }>;
  event?: CalendarEventEditTarget;
  defaultDate?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(event);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<CalendarEventFormValues>({
    resolver: zodResolver(calendarEventFormSchema) as Resolver<CalendarEventFormValues>,
    defaultValues: calendarEventFormDefaults(
      event
        ? {
            title: event.title,
            description: event.description ?? "",
            startDate: new Date(event.startDate).toISOString().slice(0, 10),
            startTime: event.startTime ?? "",
            endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 10) : "",
            endTime: event.endTime ?? "",
            customerId: event.customerId ?? "",
            orderId: event.orderId ?? "",
            taskId: event.taskId ?? "",
          }
        : defaultDate
          ? { startDate: defaultDate }
          : undefined
    ),
  });

  const customerId = watch("customerId");
  const orderId = watch("orderId");
  const taskId = watch("taskId");

  async function onSubmit(values: CalendarEventFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateCalendarEventAction(event!.id, values)
      : await createCalendarEventAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof CalendarEventFormValues, { message: String(message) });
        }
      }
      return;
    }

    toast.success(isEdit ? "Event updated" : "Event created");
    onOpenChange(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Title" required error={errors.title?.message}>
            <Input placeholder="e.g. Client meeting" {...register("title")} />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <Textarea rows={2} {...register("description")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date" required error={errors.startDate?.message}>
              <Input type="date" {...register("startDate")} />
            </Field>
            <Field label="Start Time">
              <Input type="time" {...register("startTime")} />
            </Field>
            <Field label="End Date">
              <Input type="date" {...register("endDate")} />
            </Field>
            <Field label="End Time">
              <Input type="time" {...register("endTime")} />
            </Field>
          </div>

          <Field label="Customer" hint="Optional">
            <CustomerCombobox customers={customers} value={customerId} onChange={(id) => setValue("customerId", id)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Order" hint="Optional">
              <Select value={orderId || undefined} onValueChange={(v) => setValue("orderId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Task" hint="Optional">
              <Select value={taskId || undefined} onValueChange={(v) => setValue("taskId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
