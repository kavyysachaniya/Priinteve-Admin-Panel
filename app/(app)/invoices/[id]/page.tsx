import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { PaymentHistory } from "@/components/invoices/payment-history";
import { DocumentPreview } from "@/components/documents/document-preview";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { getCompanySettings } from "@/lib/services/settings";
import type { DocumentPreviewData } from "@/lib/types/document";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const [invoice, company] = await Promise.all([getInvoiceDetail(id), getCompanySettings()]);
  if (!invoice) notFound();

  const outstandingPaise = invoice.totalPaise - invoice.amountPaidPaise;
  const isEditable = !invoice.sourceQuotationId && invoice.amountPaidPaise === 0 && invoice.status !== "CANCELLED";

  const doc: DocumentPreviewData = {
    kind: "Invoice",
    number: invoice.number,
    dateLabel: "Invoice Date",
    date: invoice.invoiceDate,
    secondaryDateLabel: "Due Date",
    secondaryDate: invoice.dueDate,
    customer: invoice.customer,
    items: invoice.items,
    subtotalPaise: invoice.subtotalPaise,
    discountPaise: invoice.discountPaise,
    taxPaise: invoice.taxPaise,
    shippingPaise: invoice.shippingPaise,
    totalPaise: invoice.totalPaise,
    notes: invoice.notes,
    terms: invoice.terms,
    company,
    amountPaidPaise: invoice.amountPaidPaise,
  };

  return (
    <div>
      <div className="print-hide">
        <PageHeader
          backHref="/invoices"
          title={
            <span className="flex items-center gap-2.5">
              {invoice.number}
              <InvoiceStatusBadge status={invoice.effectiveStatus} />
            </span>
          }
          description={
            invoice.sourceQuotation && (
              <Link href={`/quotations/${invoice.sourceQuotation.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <ArrowRightLeft className="size-3.5" /> Generated from quotation {invoice.sourceQuotation.number}
              </Link>
            )
          }
          actions={
            <InvoiceActions
              id={invoice.id}
              number={invoice.number}
              status={invoice.status}
              effectiveStatus={invoice.effectiveStatus}
              isEditable={isEditable}
              outstandingPaise={outstandingPaise}
              doc={doc}
            />
          }
        />
      </div>

      <DocumentPreview doc={doc} />

      <div className="print-hide mx-auto mt-6 w-full max-w-[210mm] space-y-6">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Payment History</h3>
          <PaymentHistory payments={invoice.payments} />
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Activity</h3>
          <ActivityTimeline items={invoice.activityLogs} />
        </div>
      </div>
    </div>
  );
}
