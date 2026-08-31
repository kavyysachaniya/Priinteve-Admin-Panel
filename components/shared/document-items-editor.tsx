"use client";

import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
  type FieldErrors,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductPickerButton, type PickableProduct } from "@/components/shared/product-picker-button";
import { computeLineItem, formatCurrency, rupeesToPaise } from "@/lib/money";
import { emptyDocumentItem, type DocumentItemValues } from "@/lib/validations/document-item";
import { cn } from "@/lib/utils";

interface ItemsFormShape {
  items: DocumentItemValues[];
}

export function DocumentItemsEditor<TFormValues extends ItemsFormShape>({
  control,
  register,
  watch,
  setValue,
  errors,
  products,
}: {
  control: Control<TFormValues>;
  register: UseFormRegister<TFormValues>;
  watch: UseFormWatch<TFormValues>;
  setValue: UseFormSetValue<TFormValues>;
  errors: FieldErrors<TFormValues>;
  products: PickableProduct[];
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    // items is always the array field on TFormValues, but useFieldArray's
    // generic inference needs a cast since TFormValues is only known to extend ItemsFormShape.
    name: "items" as never,
  });

  const items = watch("items" as never) as unknown as DocumentItemValues[];
  const itemsError = (errors as FieldErrors<ItemsFormShape>).items;

  function updateItem(index: number, patch: Partial<DocumentItemValues>) {
    const current = items[index];
    const next = { ...current, ...patch };
    setValue(`items.${index}` as never, next as never, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Item</TableHead>
              <TableHead className="min-w-[160px]">Description</TableHead>
              <TableHead className="w-24">Qty</TableHead>
              <TableHead className="w-28">Rate (₹)</TableHead>
              <TableHead className="w-24">Disc. %</TableHead>
              <TableHead className="w-24">GST %</TableHead>
              <TableHead className="w-32 text-right">Amount</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const item = items?.[index] ?? emptyDocumentItem;
              const line = computeLineItem({
                quantity: Number(item.quantity) || 0,
                ratePaise: rupeesToPaise(Number(item.rate) || 0),
                discountPercent: Number(item.discountPercent) || 0,
                gstRate: Number(item.gstRate) || 0,
              });

              return (
                <TableRow key={field.id}>
                  <TableCell className="align-top">
                    <div className="flex gap-1.5">
                      <ProductPickerButton
                        products={products}
                        onSelect={(product) =>
                          updateItem(index, {
                            productId: product.id,
                            name: product.name,
                            description: product.description ?? "",
                            rate: product.sellingPricePaise / 100,
                            gstRate: product.gstRate,
                          })
                        }
                      />
                      <Input
                        placeholder="Item name"
                        className="min-w-[140px]"
                        {...register(`items.${index}.name` as never)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Input placeholder="Optional" {...register(`items.${index}.description` as never)} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input type="number" step="0.01" min="0" {...register(`items.${index}.quantity` as never)} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input type="number" step="0.01" min="0" {...register(`items.${index}.rate` as never)} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input type="number" step="0.01" min="0" max="100" {...register(`items.${index}.discountPercent` as never)} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input type="number" step="0.01" min="0" max="100" {...register(`items.${index}.gstRate` as never)} />
                  </TableCell>
                  <TableCell className="pt-3.5 text-right align-top text-sm font-medium whitespace-nowrap">
                    {formatCurrency(line.amountPaise)}
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/40"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {itemsError?.root?.message && (
        <p className="text-xs text-destructive">{itemsError.root.message}</p>
      )}
      {itemsError?.message && !itemsError.root && (
        <p className="text-xs text-destructive">{String(itemsError.message)}</p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append(emptyDocumentItem as never)}
        className={cn("gap-1.5")}
      >
        <Plus className="size-4" /> Add Item
      </Button>
    </div>
  );
}
