export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentPreview } from "@/components/documents/document-preview";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { PrintButton } from "@/components/documents/print-button";
import { getOrderForDocument } from "@/lib/services/orders";
import { getCompanySettings } from "@/lib/services/settings";
import type { DocumentPreviewData } from "@/lib/types/document";

export const metadata = { title: "Order Document — Priinteve Business OS" };

export default async function OrderDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, company] = await Promise.all([getOrderForDocument(id), getCompanySettings()]);
  if (!order) notFound();

  const doc: DocumentPreviewData = {
    kind: "Order",
    number: order.number,
    dateLabel: "Order Date",
    date: order.orderDate,
    secondaryDateLabel: order.expectedCompletionDate ? "Expected Completion" : undefined,
    secondaryDate: order.expectedCompletionDate,
    customer: order.customer,
    items: order.items,
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    taxPaise: order.taxPaise,
    shippingPaise: order.shippingPaise,
    totalPaise: order.totalPaise,
    notes: order.notes,
    terms: null,
    company,
  };

  return (
    <div>
      <div className="print-hide">
        <PageHeader
          backHref={`/orders/${order.id}`}
          title={`Order ${order.number}`}
          actions={
            <div className="flex items-center gap-2">
              <DownloadPdfButton fileName={order.number} />
              <PrintButton variant="print" />
            </div>
          }
        />
      </div>
      <DocumentPreview doc={doc} />
    </div>
  );
}
