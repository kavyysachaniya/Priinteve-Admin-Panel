export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { QuotationStatusBadge } from "@/components/shared/status-badge";
import { QuotationActions } from "@/components/quotations/quotation-actions";
import { DocumentPreview } from "@/components/documents/document-preview";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { getQuotationDetail } from "@/lib/services/quotations";
import { getCompanySettings } from "@/lib/services/settings";
import type { DocumentPreviewData } from "@/lib/types/document";

export const metadata = { title: "Quotation" };

export default async function QuotationDetailPage({ params }: PageProps<"/quotations/[id]">) {
  const { id } = await params;
  const [quotation, company] = await Promise.all([getQuotationDetail(id), getCompanySettings()]);
  if (!quotation) notFound();

  const doc: DocumentPreviewData = {
    kind: "Quotation",
    number: quotation.number,
    dateLabel: "Issue Date",
    date: quotation.issueDate,
    secondaryDateLabel: "Valid Until",
    secondaryDate: quotation.validUntil,
    customer: quotation.customer,
    items: quotation.items,
    subtotalPaise: quotation.subtotalPaise,
    discountPaise: quotation.discountPaise,
    taxPaise: quotation.taxPaise,
    shippingPaise: quotation.shippingPaise,
    totalPaise: quotation.totalPaise,
    notes: quotation.notes,
    terms: quotation.terms,
    company,
  };

  return (
    <div>
      <div className="print-hide">
        <PageHeader
          backHref="/quotations"
          title={
            <span className="flex items-center gap-2.5">
              {quotation.number}
              <QuotationStatusBadge status={quotation.status} />
            </span>
          }
          description={
            quotation.convertedInvoice && (
              <Link href={`/invoices/${quotation.convertedInvoice.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <ArrowRightLeft className="size-3.5" /> Converted to invoice {quotation.convertedInvoice.number}
              </Link>
            )
          }
          actions={<QuotationActions id={quotation.id} number={quotation.number} status={quotation.status} hasConvertedInvoice={Boolean(quotation.convertedInvoice)} doc={doc} />}
        />
      </div>

      <DocumentPreview doc={doc} />

      <div className="print-hide mx-auto mt-6 w-full max-w-[210mm] rounded-lg border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Activity</h3>
        <ActivityTimeline items={quotation.activityLogs} />
      </div>
    </div>
  );
}
