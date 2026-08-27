"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import {
  customerFormSchema,
  customerFormDefaults,
  type CustomerFormValues,
} from "@/lib/validations/customer";
import { createCustomerAction, updateCustomerAction } from "@/lib/actions/customers";

export function CustomerForm({
  customerId,
  defaultValues,
  redirectAfterSaveTo,
}: {
  customerId?: string;
  defaultValues?: Partial<CustomerFormValues>;
  /** If provided, navigate here after save instead of the customer detail page. */
  redirectAfterSaveTo?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(customerId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { ...customerFormDefaults, ...defaultValues },
  });

  const type = watch("type");
  const status = watch("status");

  async function onSubmit(values: CustomerFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateCustomerAction(customerId!, values)
      : await createCustomerAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof CustomerFormValues, { message });
        }
      }
      return;
    }

    toast.success(isEdit ? "Customer updated successfully" : "Customer created successfully");
    router.push(redirectAfterSaveTo ?? `/customers/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FormSection title="Basic Information">
        <Field label="Customer Type" required>
          <Select value={type} onValueChange={(v) => setValue("type", v as CustomerFormValues["type"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INDIVIDUAL">Individual</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status" required>
          <Select value={status} onValueChange={(v) => setValue("status", v as CustomerFormValues["status"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={type === "BUSINESS" ? "Business Name" : "Full Name"}
          htmlFor="name"
          required
          error={errors.name?.message}
          className="sm:col-span-2"
        >
          <Input id="name" placeholder={type === "BUSINESS" ? "Acme Pvt. Ltd." : "Jane Doe"} {...register("name")} />
        </Field>

        {type === "BUSINESS" && (
          <Field label="Contact Person" htmlFor="contactPerson" error={errors.contactPerson?.message}>
            <Input id="contactPerson" placeholder="Primary contact name" {...register("contactPerson")} />
          </Field>
        )}

        <Field label="Phone Number" htmlFor="phone" required error={errors.phone?.message}>
          <Input id="phone" placeholder="98765 43210" {...register("phone")} />
        </Field>

        <Field label="WhatsApp Number" htmlFor="whatsapp" error={errors.whatsapp?.message} hint="Optional, if different from phone">
          <Input id="whatsapp" placeholder="98765 43210" {...register("whatsapp")} />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" placeholder="name@company.com" {...register("email")} />
        </Field>
      </FormSection>

      <FormSection title="Business Information" description="Required for GST-compliant invoices">
        <Field label="GSTIN" htmlFor="gstin" error={errors.gstin?.message} hint="15-character GST number">
          <Input id="gstin" placeholder="22AAAAA0000A1Z5" className="uppercase" {...register("gstin")} />
        </Field>
        <Field label="PAN" htmlFor="pan" error={errors.pan?.message}>
          <Input id="pan" placeholder="AAAAA0000A" className="uppercase" {...register("pan")} />
        </Field>
      </FormSection>

      <FormSection title="Address">
        <Field label="Billing Address" htmlFor="billingAddress" error={errors.billingAddress?.message} className="sm:col-span-2">
          <Textarea id="billingAddress" rows={2} {...register("billingAddress")} />
        </Field>
        <Field label="Shipping Address" htmlFor="shippingAddress" error={errors.shippingAddress?.message} className="sm:col-span-2" hint="Leave blank if same as billing">
          <Textarea id="shippingAddress" rows={2} {...register("shippingAddress")} />
        </Field>
        <Field label="City" htmlFor="city" error={errors.city?.message}>
          <Input id="city" {...register("city")} />
        </Field>
        <Field label="State" htmlFor="state" error={errors.state?.message}>
          <Input id="state" {...register("state")} />
        </Field>
        <Field label="Pincode" htmlFor="pincode" error={errors.pincode?.message}>
          <Input id="pincode" inputMode="numeric" {...register("pincode")} />
        </Field>
      </FormSection>

      <FormSection title="Other">
        <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea id="notes" rows={3} placeholder="Internal notes about this customer" {...register("notes")} />
        </Field>
        <Field label="Tags" htmlFor="tags" error={errors.tags?.message} className="sm:col-span-2" hint="Comma-separated, e.g. VIP, Reseller">
          <Input id="tags" placeholder="VIP, Reseller" {...register("tags")} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
        </Button>
      </div>
    </form>
  );
}
