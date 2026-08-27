"use client";

import { useState } from "react";
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
import {
  productFormSchema,
  productFormDefaults,
  type ProductFormValues,
} from "@/lib/validations/product";
import { createProductAction, updateProductAction } from "@/lib/actions/products";

export function ProductForm({
  productId,
  defaultValues,
  categorySuggestions = [],
}: {
  productId?: string;
  defaultValues?: Partial<ProductFormValues>;
  categorySuggestions?: string[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(productId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>,
    defaultValues: { ...productFormDefaults, ...defaultValues },
  });

  const type = watch("type");
  const status = watch("status");

  async function onSubmit(values: ProductFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateProductAction(productId!, values)
      : await createProductAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ProductFormValues, { message });
        }
      }
      return;
    }

    toast.success(isEdit ? "Product updated successfully" : "Product created successfully");
    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FormSection title="Basic Information">
        <Field label="Type" required>
          <Select value={type} onValueChange={(v) => setValue("type", v as ProductFormValues["type"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUCT">Product</SelectItem>
              <SelectItem value="SERVICE">Service</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status" required>
          <Select value={status} onValueChange={(v) => setValue("status", v as ProductFormValues["status"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Name" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
          <Input id="name" placeholder="Digital Business Card" {...register("name")} />
        </Field>

        <Field label="Category" htmlFor="categoryName" error={errors.categoryName?.message} hint="Type a new category or reuse an existing one">
          <Input id="categoryName" placeholder="Digital Products" list="category-suggestions" {...register("categoryName")} />
          <datalist id="category-suggestions">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="SKU" htmlFor="sku" error={errors.sku?.message} hint="Optional">
          <Input id="sku" placeholder="DBC-001" {...register("sku")} />
        </Field>

        <Field label="Description" htmlFor="description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="description" rows={3} {...register("description")} />
        </Field>
      </FormSection>

      <FormSection title="Pricing">
        <Field label="Unit" htmlFor="unit" required error={errors.unit?.message} hint="e.g. Unit, Piece, Hour, Sq. Ft.">
          <Input id="unit" {...register("unit")} />
        </Field>
        <Field label="GST Rate (%)" htmlFor="gstRate" required error={errors.gstRate?.message}>
          <Input id="gstRate" type="number" step="0.01" min="0" max="100" {...register("gstRate")} />
        </Field>
        <Field label="Selling Price (₹)" htmlFor="sellingPrice" required error={errors.sellingPrice?.message}>
          <Input id="sellingPrice" type="number" step="0.01" min="0" {...register("sellingPrice")} />
        </Field>
        <Field label="Cost Price (₹)" htmlFor="costPrice" error={errors.costPrice?.message} hint="Optional, for internal margin tracking">
          <Input id="costPrice" type="number" step="0.01" min="0" {...register("costPrice")} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
