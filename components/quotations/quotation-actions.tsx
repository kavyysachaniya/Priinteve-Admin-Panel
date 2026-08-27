"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Copy, Send, CheckCircle2, XCircle, ArrowRightLeft, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { PrintButton } from "@/components/documents/print-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  changeQuotationStatusAction,
  convertQuotationToInvoiceAction,
  duplicateQuotationAction,
  deleteQuotationAction,
} from "@/lib/actions/quotations";
import { convertQuotationToOrderAction } from "@/lib/actions/orders";
import type { QuotationStatus } from "@prisma/client";
import type { DocumentPreviewData } from "@/lib/types/document";

export function QuotationActions({
  id,
  number,
  status,
  hasConvertedInvoice,
  doc,
}: {
  id: string;
  number?: string;
  status: QuotationStatus;
  hasConvertedInvoice: boolean;
  doc?: DocumentPreviewData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(next: QuotationStatus) {
    startTransition(async () => {
      const result = await changeQuotationStatusAction(id, next);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function convert() {
    startTransition(async () => {
      const result = await convertQuotationToInvoiceAction(id);
      if (result.success) {
        toast.success("Invoice created from quotation");
        router.push(`/invoices/${result.invoiceId}`);
      } else {
        toast.error(result.message);
      }
    });
  }

  function convertOrder() {
    startTransition(async () => {
      const result = await convertQuotationToOrderAction(id);
      if (result.success) {
        toast.success(result.message);
        router.push(`/orders/${result.orderId}`);
      } else {
        toast.error(result.message);
      }
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateQuotationAction(id);
      if (result.success) {
        toast.success("Quotation duplicated");
        router.push(`/quotations/${result.id}/edit`);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="print-hide flex flex-wrap items-center gap-2">
      {status !== "CONVERTED" && (
        <Button variant="outline" asChild>
          <Link href={`/quotations/${id}/edit`}>
            <Pencil className="size-4" /> Edit
          </Link>
        </Button>
      )}
      <Button variant="outline" onClick={duplicate} disabled={pending}>
        <Copy className="size-4" /> Duplicate
      </Button>
      <DownloadPdfButton fileName={number ?? "Quotation"} doc={doc} />
      <PrintButton variant="print" />

      {status === "DRAFT" && (
        <Button onClick={() => setStatus("SENT")} disabled={pending}>
          <Send className="size-4" /> Mark as Sent
        </Button>
      )}
      {status === "SENT" && (
        <>
          <Button onClick={() => setStatus("ACCEPTED")} disabled={pending} className="bg-success/15 text-success hover:bg-success/25">
            <CheckCircle2 className="size-4" /> Mark as Accepted
          </Button>
          <Button variant="destructive" onClick={() => setStatus("REJECTED")} disabled={pending}>
            <XCircle className="size-4" /> Mark as Rejected
          </Button>
        </>
      )}
      {status === "ACCEPTED" && !hasConvertedInvoice && (
        <>
          <Button onClick={convert} disabled={pending}>
            <ArrowRightLeft className="size-4" /> Convert to Invoice
          </Button>
          <Button onClick={convertOrder} disabled={pending} variant="secondary">
            <ShoppingBag className="size-4" /> Book Print Order
          </Button>
        </>
      )}

      {status === "DRAFT" && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending}>
              <Trash2 className="size-4" /> Delete
            </Button>
          }
          title="Delete this quotation?"
          description="This can't be undone."
          confirmLabel="Delete"
          onConfirm={async () => {
            const result = await deleteQuotationAction(id);
            if (result.success) router.push("/quotations");
            return result;
          }}
        />
      )}
    </div>
  );
}
