"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
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
import { CustomerCombobox, type ComboboxCustomer } from "@/components/shared/customer-combobox";
import { paymentFormSchema, paymentFormDefaults, type PaymentFormValues } from "@/lib/validations/payment";
import { createPaymentAction } from "@/lib/actions/payments";
import { formatCurrency, paiseToRupees } from "@/lib/money";

export interface PayableInvoice {
  id: string;
  number: string;
  customerId: string;
  outstandingPaise: number;
  dueDate: Date;
}

export function PaymentForm({
  customers,
  invoices,
  defaultValues,
}: {
  customers: ComboboxCustomer[];
  invoices: PayableInvoice[];
  defaultValues?: Partial<PaymentFormValues>;
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
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema) as Resolver<PaymentFormValues>,
    defaultValues: paymentFormDefaults(defaultValues),
  });

  const customerId = watch("customerId");
  const invoiceId = watch("invoiceId");
  const method = watch("method");

  const customerInvoices = useMemo(
    () => invoices.filter((inv) => inv.customerId === customerId),
    [invoices, customerId]
  );
  const selectedInvoice = invoices.find((inv) => inv.id === invoiceId);

  function handleCustomerChange(id: string) {
    setValue("customerId", id, { shouldValidate: true });
    const stillValid = invoices.some((inv) => inv.customerId === id && inv.id === invoiceId);
    if (!stillValid) setValue("invoiceId", "");
  }

  function handleInvoiceChange(id: string) {
    setValue("invoiceId", id, { shouldValidate: true });
    const invoice = invoices.find((inv) => inv.id === id);
    if (invoice) setValue("amount", paiseToRupees(invoice.outstandingPaise));
  }

  async function onSubmit(values: PaymentFormValues) {
    setSubmitting(true);
    const result = await createPaymentAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof PaymentFormValues, { message });
        }
      }
      return;
    }

    toast.success("Payment recorded successfully");
    router.push(`/invoices/${values.invoiceId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FormSection title="Customer & Invoice">
        <Field label="Customer" required error={errors.customerId?.message}>
          <CustomerCombobox customers={customers} value={customerId} onChange={handleCustomerChange} />
        </Field>

        <Field label="Invoice" required error={errors.invoiceId?.message} hint={!customerId ? "Select a customer first" : undefined}>
          <Select value={invoiceId} onValueChange={handleInvoiceChange} disabled={!customerId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an invoice" />
            </SelectTrigger>
            <SelectContent>
              {customerInvoices.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No unpaid invoices for this customer</div>
              ) : (
                customerInvoices.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.number} — Outstanding {formatCurrency(inv.outstandingPaise)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>

        {selectedInvoice && (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Outstanding balance on {selectedInvoice.number}: <span className="font-medium text-foreground">{formatCurrency(selectedInvoice.outstandingPaise)}</span>
          </p>
        )}
      </FormSection>

      <FormSection title="Payment Details">
        <Field label="Payment Date" htmlFor="paymentDate" required error={errors.paymentDate?.message}>
          <Input id="paymentDate" type="date" {...register("paymentDate")} />
        </Field>
        <Field label="Amount (₹)" htmlFor="amount" required error={errors.amount?.message}>
          <Input id="amount" type="number" step="0.01" min="0" {...register("amount")} />
        </Field>
        <Field label="Payment Method" required>
          <Select value={method} onValueChange={(v) => setValue("method", v as PaymentFormValues["method"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
              <SelectItem value="CARD">Card</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reference Number" htmlFor="referenceNumber" error={errors.referenceNumber?.message} hint="UTR / transaction ID, optional">
          <Input id="referenceNumber" {...register("referenceNumber")} />
        </Field>
        <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea id="notes" rows={3} {...register("notes")} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Recording…" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
