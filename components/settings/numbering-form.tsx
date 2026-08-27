"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormSection } from "@/components/shared/field";
import { numberingFormSchema, type NumberingFormValues } from "@/lib/validations/settings";
import { updateNumberingAction } from "@/lib/actions/settings";

export function NumberingForm({
  defaultValues,
  nextQuotationNumber,
  nextInvoiceNumber,
}: {
  defaultValues: NumberingFormValues;
  nextQuotationNumber: string;
  nextInvoiceNumber: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NumberingFormValues>({
    resolver: zodResolver(numberingFormSchema),
    defaultValues,
  });

  async function onSubmit(values: NumberingFormValues) {
    setSubmitting(true);
    const result = await updateNumberingAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Numbering updated successfully");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormSection title="Document Numbering" description="Prefixes used for new quotations and invoices, e.g. QTN-2026-0001">
        <Field label="Quotation Prefix" htmlFor="quotationPrefix" required error={errors.quotationPrefix?.message} hint={`Next: ${nextQuotationNumber}`}>
          <Input id="quotationPrefix" className="uppercase" {...register("quotationPrefix")} />
        </Field>
        <Field label="Invoice Prefix" htmlFor="invoicePrefix" required error={errors.invoicePrefix?.message} hint={`Next: ${nextInvoiceNumber}`}>
          <Input id="invoicePrefix" className="uppercase" {...register("invoicePrefix")} />
        </Field>
      </FormSection>
      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save Numbering"}
        </Button>
      </div>
    </form>
  );
}
