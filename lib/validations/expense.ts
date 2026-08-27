import { z } from "zod";

export const expenseFormSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  categoryId: z.string().min(1, "Category is required"),
  vendorId: z.string().optional().default(""),
  date: z.string().min(1, "Date is required"),
  baseAmountPaise: z.number().int().min(0),
  gstRate: z.number().min(0).default(18),
  gstAmountPaise: z.number().int().min(0).default(0),
  totalAmountPaise: z.number().int().min(0),
  paymentMethod: z.enum(["UPI", "BANK_TRANSFER", "CASH", "CARD", "OTHER"]).default("UPI"),
  referenceNumber: z.string().optional().default(""),
  status: z.enum(["DRAFT", "RECORDED", "CANCELLED"]).default("RECORDED"),
  notes: z.string().optional().default(""),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function expenseFormDefaults(overrides?: Partial<ExpenseFormValues>): ExpenseFormValues {
  return {
    description: "",
    categoryId: "",
    vendorId: "",
    date: new Date().toISOString().slice(0, 10),
    baseAmountPaise: 0,
    gstRate: 18,
    gstAmountPaise: 0,
    totalAmountPaise: 0,
    paymentMethod: "UPI",
    referenceNumber: "",
    status: "RECORDED",
    notes: "",
    ...overrides,
  };
}
