import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { NumberingForm } from "@/components/settings/numbering-form";
import { getCompanySettings } from "@/lib/services/settings";
import { getNumberingSequences } from "@/lib/services/numbering";

import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

export default async function SettingsPage() {
  try {
    await requirePermission("settings:view");
  } catch {
    redirect("/dashboard");
  }

  const [settings, sequences] = await Promise.all([getCompanySettings(), getNumberingSequences()]);
  const quotationSeq = sequences.find((s) => s.key === "quotation")!;
  const invoiceSeq = sequences.find((s) => s.key === "invoice")!;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Company details, banking, and document defaults used across Priinteve." />

      <CompanySettingsForm
        defaultValues={{
          name: settings.name,
          tagline: settings.tagline ?? "",
          addressLine1: settings.addressLine1 ?? "",
          addressLine2: settings.addressLine2 ?? "",
          city: settings.city ?? "",
          state: settings.state ?? "",
          pincode: settings.pincode ?? "",
          phone: settings.phone ?? "",
          email: settings.email ?? "",
          website: settings.website ?? "",
          gstin: settings.gstin ?? "",
          pan: settings.pan ?? "",
          bankName: settings.bankName ?? "",
          bankAccountName: settings.bankAccountName ?? "",
          bankAccountNumber: settings.bankAccountNumber ?? "",
          bankIfsc: settings.bankIfsc ?? "",
          bankBranch: settings.bankBranch ?? "",
          quotationTerms: settings.quotationTerms ?? "",
          invoiceTerms: settings.invoiceTerms ?? "",
          defaultGstRate: settings.defaultGstRate,
          defaultValidityDays: settings.defaultValidityDays,
          defaultDueDays: settings.defaultDueDays,
        }}
      />

      <Separator className="my-8" />

      <NumberingForm
        defaultValues={{ quotationPrefix: quotationSeq.prefix, invoicePrefix: invoiceSeq.prefix }}
        nextQuotationNumber={`${quotationSeq.prefix}-${quotationSeq.year}-${pad(quotationSeq.nextNumber, quotationSeq.padding)}`}
        nextInvoiceNumber={`${invoiceSeq.prefix}-${invoiceSeq.year}-${pad(invoiceSeq.nextNumber, invoiceSeq.padding)}`}
      />
    </div>
  );
}
