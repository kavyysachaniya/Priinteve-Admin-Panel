import { z } from "zod";
import { documentItemSchema, type DocumentItemValues } from "@/lib/validations/document-item";

const dateString = z.string().min(1, "Date is required").refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date");

export const invoiceFormSchema = z
  .object({
    customerId: z.string().min(1, "Select a customer"),
    invoiceDate: dateString,
    dueDate: dateString,
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    terms: z.string().trim().max(2000).optional().or(z.literal("")),
    shippingCharge: z.coerce.number().min(0, "Can't be negative"),
    items: z.array(documentItemSchema).min(1, "Add at least one item"),
  })
  .refine((data) => new Date(data.dueDate) >= new Date(data.invoiceDate), {
    message: "Due date must be on or after the invoice date",
    path: ["dueDate"],
  });

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export function invoiceFormDefaults(overrides?: Partial<InvoiceFormValues>): InvoiceFormValues {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 15);
  return {
    customerId: "",
    invoiceDate: today.toISOString().slice(0, 10),
    dueDate: dueDate.toISOString().slice(0, 10),
    notes: "",
    terms: "",
    shippingCharge: 0,
    items: [],
    ...overrides,
  };
}

export type { DocumentItemValues };
