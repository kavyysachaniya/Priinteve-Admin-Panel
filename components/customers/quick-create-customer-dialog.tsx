"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { z } from "zod";
import { createCustomerAction } from "@/lib/actions/customers";
import { customerFormDefaults } from "@/lib/validations/customer";

const quickSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().trim().regex(/^(\+91[-\s]?)?[6-9]\d{9}$/, "Enter a valid 10-digit phone number"),
});
type QuickValues = z.infer<typeof quickSchema>;

export interface CreatedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  type: "INDIVIDUAL" | "BUSINESS";
  gstin: string | null;
}

export function QuickCreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
  initialName = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: CreatedCustomer) => void;
  initialName?: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<QuickValues>({
    resolver: zodResolver(quickSchema),
    defaultValues: { type: "INDIVIDUAL", name: initialName, phone: "" },
  });

  async function onSubmit(values: QuickValues) {
    setSubmitting(true);
    const result = await createCustomerAction({ ...customerFormDefaults, ...values });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Customer created successfully");
    onCreated({ id: result.id!, name: values.name, phone: values.phone, email: null, type: values.type, gstin: null });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Customer</DialogTitle>
          <DialogDescription>Add the essentials now — you can fill in the rest later from the customer&apos;s profile.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Customer Type" required>
            <Select value={watch("type")} onValueChange={(v) => setValue("type", v as QuickValues["type"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                <SelectItem value="BUSINESS">Business</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Name" htmlFor="qc-name" required error={errors.name?.message}>
            <Input id="qc-name" autoFocus {...register("name")} />
          </Field>
          <Field label="Phone Number" htmlFor="qc-phone" required error={errors.phone?.message}>
            <Input id="qc-phone" placeholder="98765 43210" {...register("phone")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
