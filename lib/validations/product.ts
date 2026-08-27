import { z } from "zod";

export const productFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
  type: z.enum(["PRODUCT", "SERVICE"]),
  categoryName: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unit is required").max(30),
  sellingPrice: z.coerce.number().positive("Selling price must be greater than 0"),
  costPrice: z.coerce.number().min(0, "Cost price can't be negative").optional(),
  gstRate: z.coerce.number().min(0, "GST rate can't be negative").max(100, "GST rate looks too high"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const productFormDefaults: ProductFormValues = {
  name: "",
  type: "PRODUCT",
  categoryName: "",
  description: "",
  sku: "",
  unit: "Unit",
  sellingPrice: 0,
  costPrice: undefined,
  gstRate: 18,
  status: "ACTIVE",
};
