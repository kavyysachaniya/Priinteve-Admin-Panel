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
import { vendorFormSchema, vendorFormDefaults, type VendorFormValues } from "@/lib/validations/vendor";
import { createVendorAction, updateVendorAction } from "@/lib/actions/vendors";
import type { VendorStatus } from "@prisma/client";

export function VendorForm({
  vendorId,
  defaultValues,
}: {
  vendorId?: string;
  defaultValues?: Partial<VendorFormValues>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(vendorId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema) as Resolver<VendorFormValues>,
    defaultValues: vendorFormDefaults(defaultValues),
  });

  const status = watch("status");

  async function onSubmit(values: VendorFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateVendorAction(vendorId!, values)
      : await createVendorAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof VendorFormValues, { message: String(message) });
        }
      }
      return;
    }

    toast.success(isEdit ? "Vendor updated successfully" : "Vendor added successfully");
    if (result.id) router.push(`/vendors/${result.id}`);
    else router.push("/vendors");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Business Information">
        <Field label="Business / Company Name" required error={errors.businessName?.message} className="sm:col-span-2">
          <Input placeholder="e.g. Royal Paper Mills Pvt Ltd" {...register("businessName")} />
        </Field>

        <Field label="Contact Person" error={errors.contactPerson?.message}>
          <Input placeholder="Key contact name..." {...register("contactPerson")} />
        </Field>

        <Field label="Status" required>
          <Select value={status} onValueChange={(v) => setValue("status", v as VendorStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active Supplier</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Phone" required error={errors.phone?.message}>
          <Input placeholder="+91 98765 43210" {...register("phone")} />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <Input placeholder="orders@supplier.com" {...register("email")} />
        </Field>

        <Field label="GSTIN" error={errors.gstin?.message}>
          <Input placeholder="27AAAAA0000A1Z5" className="font-mono uppercase" {...register("gstin")} />
        </Field>
      </FormSection>

      <FormSection title="Address Details">
        <Field label="Address" className="sm:col-span-2" error={errors.address?.message}>
          <Input placeholder="Street, Industrial Area..." {...register("address")} />
        </Field>

        <Field label="City" error={errors.city?.message}>
          <Input placeholder="Mumbai" {...register("city")} />
        </Field>

        <Field label="State" error={errors.state?.message}>
          <Input placeholder="Maharashtra" {...register("state")} />
        </Field>

        <Field label="PIN Code" error={errors.pincode?.message}>
          <Input placeholder="400001" {...register("pincode")} />
        </Field>
      </FormSection>

      <FormSection title="Notes & Terms">
        <Field label="Internal Notes" className="sm:col-span-2" error={errors.notes?.message}>
          <Textarea rows={3} placeholder="Payment terms, credit limits, or notes..." {...register("notes")} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Vendor Changes" : "Add Vendor"}
        </Button>
      </div>
    </form>
  );
}

