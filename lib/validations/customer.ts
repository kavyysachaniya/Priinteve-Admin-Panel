import { z } from "zod";

const PHONE_REGEX = /^(\+91[-\s]?)?[6-9]\d{9}$/;
const PINCODE_REGEX = /^\d{6}$/;
const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]{1}$/;

export const customerFormSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name is too long"),
  contactPerson: z.string().trim().max(150).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Enter a valid 10-digit Indian phone number"),
  whatsapp: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Enter a valid 10-digit Indian phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_REGEX, "Enter a valid 15-character GSTIN")
    .optional()
    .or(z.literal("")),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_REGEX, "Enter a valid 10-character PAN")
    .optional()
    .or(z.literal("")),
  billingAddress: z.string().trim().max(500).optional().or(z.literal("")),
  shippingAddress: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: z
    .string()
    .trim()
    .regex(PINCODE_REGEX, "Enter a valid 6-digit pincode")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  tags: z.string().trim().max(300).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const customerFormDefaults: CustomerFormValues = {
  type: "INDIVIDUAL",
  name: "",
  contactPerson: "",
  phone: "",
  whatsapp: "",
  email: "",
  gstin: "",
  pan: "",
  billingAddress: "",
  shippingAddress: "",
  city: "",
  state: "",
  pincode: "",
  notes: "",
  tags: "",
  status: "ACTIVE",
};
