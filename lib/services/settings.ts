import { prisma } from "@/lib/prisma";
import type { CompanySettings, Prisma } from "@prisma/client";

const DEFAULT_SETTINGS: CompanySettings = {
  id: "default",
  name: "Priinteve",
  tagline: "Print. Design. Digital.",
  logoUrl: null,
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
  updatedAt: new Date(),
};

/** Returns the single CompanySettings row, creating it with sensible defaults on first access. */
export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const existing = await prisma.companySettings.findFirst();
    if (existing) return existing;
    return await prisma.companySettings.create({ data: DEFAULT_SETTINGS });
  } catch (err) {
    console.error("Error fetching company settings:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function updateCompanySettings(data: Prisma.CompanySettingsUpdateInput) {
  const existing = await getCompanySettings();
  return prisma.companySettings.update({ where: { id: existing.id }, data });
}
