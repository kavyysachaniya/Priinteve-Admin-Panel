import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().optional().default(""),
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional().default(""),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPricePaise: z.number().int().min(0, "Unit price must be positive"),
  totalPaise: z.number().int().min(0),
});

export const orderFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  title: z.string().min(1, "Order title is required").max(200),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedCompletionDate: z.string().optional().default(""),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  subtotalPaise: z.number().int().min(0),
  discountPaise: z.number().int().min(0).default(0),
  taxablePaise: z.number().int().min(0),
  cgstPaise: z.number().int().min(0).default(0),
  sgstPaise: z.number().int().min(0).default(0),
  igstPaise: z.number().int().min(0).default(0),
  totalAmountPaise: z.number().int().min(0),
  notes: z.string().optional().default(""),
  quotationId: z.string().optional().default(""),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export function orderFormDefaults(overrides?: Partial<OrderFormValues>): OrderFormValues {
  return {
    customerId: "",
    title: "",
    priority: "MEDIUM",
    orderDate: new Date().toISOString().slice(0, 10),
    expectedCompletionDate: "",
    items: [{ productId: "", name: "", description: "", quantity: 1, unitPricePaise: 0, totalPaise: 0 }],
    subtotalPaise: 0,
    discountPaise: 0,
    taxablePaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    totalAmountPaise: 0,
    notes: "",
    quotationId: "",
    ...overrides,
  };
}

