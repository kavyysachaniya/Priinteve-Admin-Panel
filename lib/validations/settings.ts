import { z } from "zod";

export const companySettingsFormSchema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(150),
  tagline: z.string().trim().max(150).optional().or(z.literal("")),
  addressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: z.string().trim().max(10).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  website: z.string().trim().max(150).optional().or(z.literal("")),
  gstin: z.string().trim().toUpperCase().max(15).optional().or(z.literal("")),
  pan: z.string().trim().toUpperCase().max(10).optional().or(z.literal("")),
  bankName: z.string().trim().max(100).optional().or(z.literal("")),
  bankAccountName: z.string().trim().max(150).optional().or(z.literal("")),
  bankAccountNumber: z.string().trim().max(30).optional().or(z.literal("")),
  bankIfsc: z.string().trim().toUpperCase().max(15).optional().or(z.literal("")),
  bankBranch: z.string().trim().max(100).optional().or(z.literal("")),
  quotationTerms: z.string().trim().max(2000).optional().or(z.literal("")),
  invoiceTerms: z.string().trim().max(2000).optional().or(z.literal("")),
  defaultGstRate: z.coerce.number().min(0).max(100),
  defaultValidityDays: z.coerce.number().int().positive(),
  defaultDueDays: z.coerce.number().int().positive(),
});

export type CompanySettingsFormValues = z.infer<typeof companySettingsFormSchema>;

export const numberingFormSchema = z.object({
  quotationPrefix: z.string().trim().min(1, "Required").max(10),
  invoicePrefix: z.string().trim().min(1, "Required").max(10),
});

export type NumberingFormValues = z.infer<typeof numberingFormSchema>;
