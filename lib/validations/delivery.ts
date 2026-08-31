import { z } from "zod";

export const deliveryFormSchema = z.object({
  orderId: z.string().min(1, "Order is required"),
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  deliveryMethod: z.enum(["SELF_DELIVERY", "COURIER", "PICKUP", "OTHER"]).default("COURIER"),
  trackingNumber: z.string().optional().default(""),
  assignedPerson: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export type DeliveryFormValues = z.infer<typeof deliveryFormSchema>;

export function deliveryFormDefaults(overrides?: Partial<DeliveryFormValues>): DeliveryFormValues {
  return {
    orderId: "",
    deliveryAddress: "",
    contactNumber: "",
    deliveryDate: new Date().toISOString().slice(0, 10),
    deliveryMethod: "COURIER",
    trackingNumber: "",
    assignedPerson: "",
    notes: "",
    ...overrides,
  };
}
