import { z } from "zod";
import { documentItemSchema, type DocumentItemValues } from "@/lib/validations/document-item";

const dateString = z.string().min(1, "Date is required").refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date");

export const quotationFormSchema = z
  .object({
    customerId: z.string().min(1, "Select a customer"),
    issueDate: dateString,
    validUntil: dateString,
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    terms: z.string().trim().max(2000).optional().or(z.literal("")),
    shippingCharge: z.coerce.number().min(0, "Can't be negative"),
    items: z.array(documentItemSchema).min(1, "Add at least one item"),
  })
  .refine((data) => new Date(data.validUntil) >= new Date(data.issueDate), {
    message: "Valid until date must be on or after the issue date",
    path: ["validUntil"],
  });

export type QuotationFormValues = z.infer<typeof quotationFormSchema>;

export function quotationFormDefaults(overrides?: Partial<QuotationFormValues>): QuotationFormValues {
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 15);
  return {
    customerId: "",
    issueDate: today.toISOString().slice(0, 10),
    validUntil: validUntil.toISOString().slice(0, 10),
    notes: "",
    terms: "",
    shippingCharge: 0,
    items: [],
    ...overrides,
  };
}

export type { DocumentItemValues };
