"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Send, Ban, Wallet, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { markInvoiceSentAction, cancelInvoiceAction } from "@/lib/actions/invoices";
import type { InvoiceStatus } from "@prisma/client";
import type { DocumentPreviewData } from "@/lib/types/document";

export function InvoiceActions({
  id,
  number,
  status,
  effectiveStatus,
  isEditable,
  outstandingPaise,
  doc,
}: {
  id: string;
  number?: string;
  status: InvoiceStatus;
  effectiveStatus: InvoiceStatus;
  isEditable: boolean;
  outstandingPaise: number;
  doc?: DocumentPreviewData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markSent() {
    startTransition(async () => {
      const result = await markInvoiceSentAction(id);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <div className="print-hide flex flex-wrap items-center gap-2">
      {isEditable && (
        <Button variant="outline" asChild>
          <Link href={`/invoices/${id}/edit`}>
            <Pencil className="size-4" /> Edit
          </Link>
        </Button>
      )}
      <DownloadPdfButton fileName={number ?? "Invoice"} doc={doc} />
      <PrintButton variant="print" />
      <Button variant="outline" onClick={share}>
        <Share2 className="size-4" /> Share
      </Button>

      {status === "DRAFT" && (
        <Button variant="outline" onClick={markSent} disabled={pending}>
          <Send className="size-4" /> Mark as Sent
        </Button>
      )}

      {outstandingPaise > 0 && effectiveStatus !== "CANCELLED" && (
        <Button asChild>
          <Link href={`/payments/new?invoiceId=${id}`}>
            <Wallet className="size-4" /> Record Payment
          </Link>
        </Button>
      )}

      {status !== "CANCELLED" && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending}>
              <Ban className="size-4" /> Cancel Invoice
            </Button>
          }
          title="Cancel this invoice?"
          description="Cancelled invoices are excluded from revenue and outstanding totals. This can't be undone."
          confirmLabel="Cancel Invoice"
          onConfirm={async () => {
            const result = await cancelInvoiceAction(id);
            if (result.success) router.refresh();
            return result;
          }}
        />
      )}
    </div>
  );
}
