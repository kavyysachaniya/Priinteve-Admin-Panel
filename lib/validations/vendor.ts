import { z } from "zod";

export const vendorFormSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(200),
  contactPerson: z.string().optional().default(""),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  gstin: z
    .string()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format")
    .optional()
    .or(z.literal("")),
  address: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  pincode: z.string().optional().default(""),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  notes: z.string().optional().default(""),
});

export type VendorFormValues = z.infer<typeof vendorFormSchema>;

export function vendorFormDefaults(overrides?: Partial<VendorFormValues>): VendorFormValues {
  return {
    businessName: "",
    contactPerson: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    status: "ACTIVE",
    notes: "",
    ...overrides,
  };
}

