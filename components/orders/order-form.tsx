"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection } from "@/components/shared/field";
import { CustomerCombobox, type ComboboxCustomer } from "@/components/shared/customer-combobox";
import { orderFormSchema, orderFormDefaults, type OrderFormValues } from "@/lib/validations/order";
import { createOrderAction, updateOrderAction } from "@/lib/actions/orders";
import { formatCurrency, rupeesToPaise } from "@/lib/money";
import type { OrderPriority } from "@prisma/client";

export function OrderForm({
  orderId,
  defaultValues,
  customers = [],
  products = [],
}: {
  orderId?: string;
  defaultValues?: Partial<OrderFormValues>;
  customers?: ComboboxCustomer[];
  products?: Array<{ id: string; name: string; basePricePaise: number }>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(orderId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema) as Resolver<OrderFormValues>,
    defaultValues: orderFormDefaults(defaultValues),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const customerId = watch("customerId");
  const priority = watch("priority");
  const items = watch("items") || [];

  const subtotalPaise = items.reduce((sum, item) => sum + (item.totalPaise || 0), 0);
  const taxablePaise = subtotalPaise;
  const gstPaise = Math.round((taxablePaise * 18) / 100);
  const totalAmountPaise = taxablePaise + gstPaise;

  async function onSubmit(values: OrderFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateOrderAction(orderId!, { ...values, subtotalPaise, taxablePaise, totalAmountPaise })
      : await createOrderAction({ ...values, subtotalPaise, taxablePaise, totalAmountPaise });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof OrderFormValues, { message: String(message) });
        }
      }
      return;
    }

    toast.success(isEdit ? "Order updated successfully" : "Order created successfully");
    if (result.id) router.push(`/orders/${result.id}`);
    else router.push("/orders");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Order Information">
        <Field label="Customer" required error={errors.customerId?.message}>
          <CustomerCombobox
            customers={customers}
            value={customerId}
            onChange={(id) => setValue("customerId", id, { shouldValidate: true })}
          />
        </Field>

        <Field label="Order Title / Job Name" required error={errors.title?.message}>
          <Input placeholder="e.g. 10,000 Corporate Visiting Cards" {...register("title")} />
        </Field>

        <Field label="Priority" required>
          <Select value={priority} onValueChange={(v) => setValue("priority", v as OrderPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Order Date" required error={errors.orderDate?.message}>
          <Input type="date" {...register("orderDate")} />
        </Field>

        <Field label="Target Completion Date" error={errors.expectedCompletionDate?.message}>
          <Input type="date" {...register("expectedCompletionDate")} />
        </Field>
      </FormSection>

      <FormSection title="Print Items & Line Items">
        <div className="sm:col-span-2 space-y-3">
          {fields.map((field, index) => {
            const qty = watch(`items.${index}.quantity`) || 1;
            const unitPaise = watch(`items.${index}.unitPricePaise`) || 0;
            const itemTotal = qty * unitPaise;

            return (
              <div key={field.id} className="p-3 rounded-lg border bg-muted/20 grid gap-3 sm:grid-cols-6 items-end text-xs">
                <div className="sm:col-span-2">
                  <label className="font-semibold block mb-1">Item Name</label>
                  <Input placeholder="Item description..." {...register(`items.${index}.name` as const)} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Qty</label>
                  <Input
                    type="number"
                    min="1"
                    {...register(`items.${index}.quantity` as const, {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const q = parseInt(e.target.value) || 1;
                        setValue(`items.${index}.totalPaise`, q * unitPaise);
                      },
                    })}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Unit Price (₹)</label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={unitPaise / 100}
                    onChange={(e) => {
                      const paise = rupeesToPaise(parseFloat(e.target.value) || 0);
                      setValue(`items.${index}.unitPricePaise`, paise);
                      setValue(`items.${index}.totalPaise`, qty * paise);
                    }}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Total</label>
                  <p className="py-2 font-bold text-foreground">{formatCurrency(itemTotal)}</p>
                </div>
                <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/40 size-8"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                    </Button>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ productId: "", name: "", description: "", quantity: 1, unitPricePaise: 0, totalPaise: 0 })}
          >
            <Plus className="size-4 mr-1" /> Add Line Item
          </Button>
        </div>
      </FormSection>

      <div className="p-4 rounded-lg border bg-muted/40 flex justify-between items-center text-sm font-bold">
        <span>Order Total (Inc GST 18%):</span>
        <span className="text-lg text-primary">{formatCurrency(totalAmountPaise)}</span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Order Changes" : "Create Order"}
        </Button>
      </div>
    </form>
  );
}

