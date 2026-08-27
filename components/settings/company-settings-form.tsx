"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection } from "@/components/shared/field";
import { companySettingsFormSchema, type CompanySettingsFormValues } from "@/lib/validations/settings";
import { updateCompanySettingsAction } from "@/lib/actions/settings";

export function CompanySettingsForm({ defaultValues }: { defaultValues: CompanySettingsFormValues }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsFormSchema) as Resolver<CompanySettingsFormValues>,
    defaultValues,
  });

  async function onSubmit(values: CompanySettingsFormValues) {
    setSubmitting(true);
    const result = await updateCompanySettingsAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof CompanySettingsFormValues, { message });
        }
      }
      return;
    }
    toast.success("Settings saved successfully");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FormSection title="Company Details" description="Shown on the letterhead of every quotation and invoice">
        <Field label="Company Name" htmlFor="name" required error={errors.name?.message}>
          <Input id="name" {...register("name")} />
        </Field>
        <Field label="Tagline" htmlFor="tagline" error={errors.tagline?.message}>
          <Input id="tagline" {...register("tagline")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" {...register("phone")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" {...register("email")} />
        </Field>
        <Field label="Website" htmlFor="website" error={errors.website?.message}>
          <Input id="website" {...register("website")} />
        </Field>
        <Field label="GSTIN" htmlFor="gstin" error={errors.gstin?.message}>
          <Input id="gstin" className="uppercase" {...register("gstin")} />
        </Field>
        <Field label="PAN" htmlFor="pan" error={errors.pan?.message}>
          <Input id="pan" className="uppercase" {...register("pan")} />
        </Field>
      </FormSection>

      <FormSection title="Address">
        <Field label="Address Line 1" htmlFor="addressLine1" error={errors.addressLine1?.message} className="sm:col-span-2">
          <Input id="addressLine1" {...register("addressLine1")} />
        </Field>
        <Field label="Address Line 2" htmlFor="addressLine2" error={errors.addressLine2?.message} className="sm:col-span-2">
          <Input id="addressLine2" {...register("addressLine2")} />
        </Field>
        <Field label="City" htmlFor="city" error={errors.city?.message}>
          <Input id="city" {...register("city")} />
        </Field>
        <Field label="State" htmlFor="state" error={errors.state?.message}>
          <Input id="state" {...register("state")} />
        </Field>
        <Field label="Pincode" htmlFor="pincode" error={errors.pincode?.message}>
          <Input id="pincode" {...register("pincode")} />
        </Field>
      </FormSection>

      <FormSection title="Bank Details" description="Shown in the invoice footer for customer payments">
        <Field label="Account Holder Name" htmlFor="bankAccountName" error={errors.bankAccountName?.message}>
          <Input id="bankAccountName" {...register("bankAccountName")} />
        </Field>
        <Field label="Bank Name" htmlFor="bankName" error={errors.bankName?.message}>
          <Input id="bankName" {...register("bankName")} />
        </Field>
        <Field label="Account Number" htmlFor="bankAccountNumber" error={errors.bankAccountNumber?.message}>
          <Input id="bankAccountNumber" {...register("bankAccountNumber")} />
        </Field>
        <Field label="IFSC Code" htmlFor="bankIfsc" error={errors.bankIfsc?.message}>
          <Input id="bankIfsc" className="uppercase" {...register("bankIfsc")} />
        </Field>
        <Field label="Branch" htmlFor="bankBranch" error={errors.bankBranch?.message}>
          <Input id="bankBranch" {...register("bankBranch")} />
        </Field>
      </FormSection>

      <FormSection title="Document Defaults">
        <Field label="Default GST Rate (%)" htmlFor="defaultGstRate" required error={errors.defaultGstRate?.message}>
          <Input id="defaultGstRate" type="number" step="0.01" min="0" max="100" {...register("defaultGstRate")} />
        </Field>
        <Field label="Quotation Validity (days)" htmlFor="defaultValidityDays" required error={errors.defaultValidityDays?.message}>
          <Input id="defaultValidityDays" type="number" min="1" {...register("defaultValidityDays")} />
        </Field>
        <Field label="Invoice Due Period (days)" htmlFor="defaultDueDays" required error={errors.defaultDueDays?.message}>
          <Input id="defaultDueDays" type="number" min="1" {...register("defaultDueDays")} />
        </Field>
      </FormSection>

      <FormSection title="Terms & Conditions">
        <Field label="Default Quotation Terms" htmlFor="quotationTerms" error={errors.quotationTerms?.message} className="sm:col-span-2">
          <Textarea id="quotationTerms" rows={4} {...register("quotationTerms")} />
        </Field>
        <Field label="Default Invoice Terms" htmlFor="invoiceTerms" error={errors.invoiceTerms?.message} className="sm:col-span-2">
          <Textarea id="invoiceTerms" rows={4} {...register("invoiceTerms")} />
        </Field>
      </FormSection>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}
