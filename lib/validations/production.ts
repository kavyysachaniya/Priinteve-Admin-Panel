import { z } from "zod";

export const productionJobFormSchema = z.object({
  orderId: z.string().min(1, "Order is required"),
  orderItemId: z.string().optional().default(""),
  productId: z.string().optional().default(""),
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  assignedToId: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  expectedCompletionDate: z.string().optional().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  internalNotes: z.string().optional().default(""),
});

export type ProductionJobFormValues = z.infer<typeof productionJobFormSchema>;

export function productionJobFormDefaults(overrides?: Partial<ProductionJobFormValues>): ProductionJobFormValues {
  return {
    orderId: "",
    orderItemId: "",
    productId: "",
    itemName: "",
    quantity: 1,
    assignedToId: "",
    startDate: "",
    expectedCompletionDate: "",
    priority: "MEDIUM",
    internalNotes: "",
    ...overrides,
  };
}
