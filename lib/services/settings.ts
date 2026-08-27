import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const DEFAULT_SETTINGS = {
  name: "Priinteve",
  tagline: "Print. Design. Digital.",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
  website: "",
  gstin: "",
  pan: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankBranch: "",
  quotationTerms:
    "1. Prices are valid until the date mentioned above.\n2. 50% advance payment required to begin work.\n3. Delivery timelines begin after design/content approval.",
  invoiceTerms:
    "1. Payment due within the stated due date.\n2. Please share the payment reference after transfer.\n3. Goods once sold / services rendered are not refundable.",
  defaultGstRate: 18,
  defaultValidityDays: 15,
  defaultDueDays: 15,
};

/** Returns the single CompanySettings row, creating it with sensible defaults on first access. */
export async function getCompanySettings() {
  const existing = await prisma.companySettings.findFirst();
  if (existing) return existing;
  return prisma.companySettings.create({ data: DEFAULT_SETTINGS });
}

export async function updateCompanySettings(data: Prisma.CompanySettingsUpdateInput) {
  const existing = await getCompanySettings();
  return prisma.companySettings.update({ where: { id: existing.id }, data });
}
