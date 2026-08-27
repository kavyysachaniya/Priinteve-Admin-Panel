"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection } from "@/components/shared/field";
import { expenseFormSchema, expenseFormDefaults, type ExpenseFormValues } from "@/lib/validations/expense";
import { createExpenseAction, updateExpenseAction } from "@/lib/actions/expenses";
import { formatCurrency, rupeesToPaise } from "@/lib/money";
import type { ExpenseStatus, PaymentMethod } from "@prisma/client";

export function ExpenseForm({
  expenseId,
  defaultValues,
  categories = [],
  vendors = [],
}: {
  expenseId?: string;
  defaultValues?: Partial<ExpenseFormValues>;
  categories?: Array<{ id: string; name: string }>;
  vendors?: Array<{ id: string; businessName: string }>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(expenseId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema) as Resolver<ExpenseFormValues>,
    defaultValues: expenseFormDefaults(defaultValues),
  });

  const categoryId = watch("categoryId");
  const vendorId = watch("vendorId");
  const paymentMethod = watch("paymentMethod");
  const status = watch("status");

  const [baseRupees, setBaseRupees] = useState<number>(
    defaultValues?.baseAmountPaise ? defaultValues.baseAmountPaise / 100 : 0
  );
  const [gstRate, setGstRate] = useState<number>(defaultValues?.gstRate ?? 18);

  useEffect(() => {
    const basePaise = rupeesToPaise(baseRupees);
    const gstPaise = Math.round((basePaise * gstRate) / 100);
    const totalPaise = basePaise + gstPaise;

    setValue("baseAmountPaise", basePaise);
    setValue("gstRate", gstRate);
    setValue("gstAmountPaise", gstPaise);
    setValue("totalAmountPaise", totalPaise);
  }, [baseRupees, gstRate, setValue]);

  const basePaise = rupeesToPaise(baseRupees);
  const gstPaise = Math.round((basePaise * gstRate) / 100);
  const totalPaise = basePaise + gstPaise;

  async function onSubmit(values: ExpenseFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateExpenseAction(expenseId!, values)
      : await createExpenseAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ExpenseFormValues, { message: String(message) });
        }
      }
      return;
    }

    toast.success(isEdit ? "Expense updated successfully" : "Expense recorded successfully");
    if (result.id) router.push(`/expenses/${result.id}`);
    else router.push("/expenses");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Expense Details">
        <Field label="Category" required error={errors.categoryId?.message}>
          <Select value={categoryId} onValueChange={(v) => setValue("categoryId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Vendor / Supplier" error={errors.vendorId?.message}>
          <Select value={vendorId ?? ""} onValueChange={(v) => setValue("vendorId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Vendor (Optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None / Direct Payout</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.businessName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Description" required error={errors.description?.message} className="sm:col-span-2">
          <Input placeholder="Description of items or service..." {...register("description")} />
        </Field>

        <Field label="Expense Date" required error={errors.date?.message}>
          <Input type="date" {...register("date")} />
        </Field>

        <Field label="Status" required>
          <Select value={status} onValueChange={(v) => setValue("status", v as ExpenseStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RECORDED">Recorded (Affects Net Profit)</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

      <FormSection title="Amount & Tax Calculation">
        <Field label="Base Amount (₹)" required>
          <Input
            type="number"
            step="0.01"
            value={baseRupees || ""}
            onChange={(e) => setBaseRupees(parseFloat(e.target.value) || 0)}
          />
        </Field>

        <Field label="GST Rate (%)">
          <Select value={String(gstRate)} onValueChange={(v) => setGstRate(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0% (Nil / Exempt)</SelectItem>
              <SelectItem value="5">5% GST</SelectItem>
              <SelectItem value="12">12% GST</SelectItem>
              <SelectItem value="18">18% GST</SelectItem>
              <SelectItem value="28">28% GST</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="sm:col-span-2 p-3 rounded-lg border bg-muted/30 text-xs flex justify-between items-center font-medium">
          <span>Calculated GST: <strong>{formatCurrency(gstPaise)}</strong></span>
          <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
            Total Expense: {formatCurrency(totalPaise)}
          </span>
        </div>
      </FormSection>

      <FormSection title="Payment Details">
        <Field label="Payment Method" required>
          <Select value={paymentMethod} onValueChange={(v) => setValue("paymentMethod", v as PaymentMethod)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
              <SelectItem value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="CARD">Credit / Debit Card</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Reference / UTR #" error={errors.referenceNumber?.message}>
          <Input placeholder="Receipt or Transaction UTR..." {...register("referenceNumber")} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Record Expense"}
        </Button>
      </div>
    </form>
  );
}

