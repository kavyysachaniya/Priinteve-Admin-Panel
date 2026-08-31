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
  productionJobFormSchema,
  productionJobFormDefaults,
  type ProductionJobFormValues,
} from "@/lib/validations/production";
import { createProductionJobAction } from "@/lib/actions/production";
import type { OrderPriority } from "@prisma/client";

interface OrderItemOption {
  id: string;
  name: string;
  productId: string | null;
  quantity: number;
}

interface UserOption {
  id: string;
  name: string;
}

export function ProductionJobForm({
  order,
  items,
  users,
}: {
  order: { id: string; number: string; priority: OrderPriority };
  items: OrderItemOption[];
  users: UserOption[];
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
  } = useForm<ProductionJobFormValues>({
    resolver: zodResolver(productionJobFormSchema) as Resolver<ProductionJobFormValues>,
    defaultValues: productionJobFormDefaults({ orderId: order.id, priority: order.priority }),
  });

  const orderItemId = watch("orderItemId");
  const assignedToId = watch("assignedToId");
  const priority = watch("priority");

  function handlePickItem(itemId: string) {
    setValue("orderItemId", itemId);
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setValue("itemName", item.name, { shouldValidate: true });
      setValue("quantity", item.quantity, { shouldValidate: true });
      setValue("productId", item.productId ?? "");
    }
  }

  async function onSubmit(values: ProductionJobFormValues) {
    setSubmitting(true);
    const result = await createProductionJobAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ProductionJobFormValues, { message: String(message) });
        }
      }
      return;
    }

    toast.success("Production job created");
    router.push(`/production/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="Job Details" description={`For order ${order.number}`}>
        {items.length > 0 && (
          <Field label="Prefill from an order item" className="sm:col-span-2" hint="Optional — fills in item name, quantity, and product below.">
            <Select value={orderItemId || undefined} onValueChange={handlePickItem}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an item…" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Item Name" required error={errors.itemName?.message}>
          <Input placeholder="e.g. Visiting Cards — 350gsm matte" {...register("itemName")} />
        </Field>

        <Field label="Quantity" required error={errors.quantity?.message}>
          <Input type="number" step="0.01" min="0.01" {...register("quantity", { valueAsNumber: true })} />
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

        <Field label="Assigned To" hint="Optional">
          <Select value={assignedToId || undefined} onValueChange={(v) => setValue("assignedToId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Start Date">
          <Input type="date" {...register("startDate")} />
        </Field>

        <Field label="Expected Completion Date">
          <Input type="date" {...register("expectedCompletionDate")} />
        </Field>

        <Field label="Internal Notes" className="sm:col-span-2">
          <Textarea rows={3} placeholder="Prepress notes, paper stock, finishing instructions…" {...register("internalNotes")} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create Production Job"}
        </Button>
      </div>
    </form>
  );
}
