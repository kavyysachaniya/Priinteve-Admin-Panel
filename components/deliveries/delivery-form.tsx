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
import {
  deliveryFormSchema,
  deliveryFormDefaults,
  type DeliveryFormValues,
} from "@/lib/validations/delivery";
import { createDeliveryAction } from "@/lib/actions/deliveries";

export function DeliveryForm({
  order,
}: {
  order: { id: string; number: string; deliveryAddress: string; contactNumber: string };
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliveryFormSchema) as Resolver<DeliveryFormValues>,
    defaultValues: deliveryFormDefaults({
      orderId: order.id,
      deliveryAddress: order.deliveryAddress,
      contactNumber: order.contactNumber,
    }),
  });

  const deliveryMethod = watch("deliveryMethod");

  async function onSubmit(values: DeliveryFormValues) {
    setSubmitting(true);
    const result = await createDeliveryAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof DeliveryFormValues, { message: String(message) });
        }
      }
      return;
    }

    toast.success("Delivery created");
    router.push(`/deliveries/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Delivery Details" description={`For order ${order.number}`}>
        <Field label="Delivery Address" required error={errors.deliveryAddress?.message} className="sm:col-span-2">
          <Textarea rows={2} {...register("deliveryAddress")} />
        </Field>

        <Field label="Contact Number" required error={errors.contactNumber?.message}>
          <Input {...register("contactNumber")} />
        </Field>

        <Field label="Delivery Date" required error={errors.deliveryDate?.message}>
          <Input type="date" {...register("deliveryDate")} />
        </Field>

        <Field label="Delivery Method" required>
          <Select value={deliveryMethod} onValueChange={(v) => setValue("deliveryMethod", v as DeliveryFormValues["deliveryMethod"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SELF_DELIVERY">Self Delivery</SelectItem>
              <SelectItem value="COURIER">Courier</SelectItem>
              <SelectItem value="PICKUP">Customer Pickup</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Tracking Number" hint="Optional">
          <Input {...register("trackingNumber")} />
        </Field>

        <Field label="Assigned Person" hint="Optional — courier or delivery staff name">
          <Input {...register("assignedPerson")} />
        </Field>

        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} {...register("notes")} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create Delivery"}
        </Button>
      </div>
    </form>
  );
}
