import { z } from "zod";

/** A single line item as entered in a quotation/invoice form (rupee amounts, not paise). */
export const documentItemSchema = z.object({
  productId: z.string().optional().nullable(),
  name: z.string().trim().min(1, "Item name is required").max(200),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate can't be negative"),
  discountPercent: z.coerce.number().min(0, "Can't be negative").max(100, "Can't exceed 100%"),
  gstRate: z.coerce.number().min(0, "Can't be negative").max(100, "Looks too high"),
});

export type DocumentItemValues = z.infer<typeof documentItemSchema>;

export const emptyDocumentItem: DocumentItemValues = {
  productId: null,
  name: "",
  description: "",
  quantity: 1,
  rate: 0,
  discountPercent: 0,
  gstRate: 18,
};
