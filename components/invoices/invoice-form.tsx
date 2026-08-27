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
import { CustomerCombobox, type ComboboxCustomer } from "@/components/shared/customer-combobox";
import { DocumentItemsEditor } from "@/components/shared/document-items-editor";
import { DocumentTotalsSummary } from "@/components/shared/document-totals-summary";
import type { PickableProduct } from "@/components/shared/product-picker-button";
import {
  invoiceFormSchema,
  invoiceFormDefaults,
  type InvoiceFormValues,
} from "@/lib/validations/invoice";
import { createInvoiceAction, updateInvoiceAction } from "@/lib/actions/invoices";
import { computeDocumentTotals, rupeesToPaise } from "@/lib/money";

export function InvoiceForm({
  invoiceId,
  invoiceNumber,
  defaultValues,
  customers,
  products,
}: {
  invoiceId?: string;
  invoiceNumber?: string;
  defaultValues?: Partial<InvoiceFormValues>;
  customers: ComboboxCustomer[];
  products: PickableProduct[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(invoiceId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    setError,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema) as Resolver<InvoiceFormValues>,
    defaultValues: invoiceFormDefaults(defaultValues),
  });

  const items = watch("items");
  const shippingCharge = watch("shippingCharge");
  const customerId = watch("customerId");

  const totals = computeDocumentTotals(
    items.map((item) => ({
      quantity: Number(item.quantity) || 0,
      ratePaise: rupeesToPaise(Number(item.rate) || 0),
      discountPercent: Number(item.discountPercent) || 0,
      gstRate: Number(item.gstRate) || 0,
    })),
    rupeesToPaise(Number(shippingCharge) || 0)
  );

  async function onSubmit(values: InvoiceFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateInvoiceAction(invoiceId!, values)
      : await createInvoiceAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof InvoiceFormValues, { message });
        }
      }
      return;
    }

    toast.success(isEdit ? "Invoice saved successfully" : "Invoice created successfully");
    router.push(`/invoices/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FormSection title="Customer">
        <div className="sm:col-span-2">
          <Field label="Customer" required error={errors.customerId?.message}>
            <CustomerCombobox customers={customers} value={customerId} onChange={(id) => setValue("customerId", id, { shouldValidate: true })} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Invoice Details">
        {invoiceNumber && (
          <Field label="Invoice Number">
            <Input value={invoiceNumber} disabled />
          </Field>
        )}
        <Field label="Invoice Date" htmlFor="invoiceDate" required error={errors.invoiceDate?.message}>
          <Input id="invoiceDate" type="date" {...register("invoiceDate")} />
        </Field>
        <Field label="Due Date" htmlFor="dueDate" required error={errors.dueDate?.message}>
          <Input id="dueDate" type="date" {...register("dueDate")} />
        </Field>
      </FormSection>

      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Items</h3>
        <DocumentItemsEditor
          control={control}
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
          products={products}
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={4} placeholder="Visible to the customer on the document" {...register("notes")} />
          </Field>
          <Field label="Terms & Conditions" htmlFor="terms" error={errors.terms?.message}>
            <Textarea id="terms" rows={4} {...register("terms")} />
          </Field>
        </div>

        <DocumentTotalsSummary
          subtotalPaise={totals.subtotalPaise}
          discountPaise={totals.discountPaise}
          taxPaise={totals.taxPaise}
          totalPaise={totals.totalPaise}
          shippingSlot={
            <Input
              type="number"
              step="0.01"
              min="0"
              className="h-8 w-28 text-right"
              {...register("shippingCharge")}
            />
          }
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}
