import { z } from "zod";

const dateString = z.string().min(1, "Date is required").refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date");

export const paymentFormSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  invoiceId: z.string().min(1, "Select an invoice"),
  paymentDate: dateString,
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"]),
  referenceNumber: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export function paymentFormDefaults(overrides?: Partial<PaymentFormValues>): PaymentFormValues {
  return {
    customerId: "",
    invoiceId: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: 0,
    method: "UPI",
    referenceNumber: "",
    notes: "",
    ...overrides,
  };
}
