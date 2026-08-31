"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Copy, Send, CheckCircle2, XCircle, ArrowRightLeft, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  changeQuotationStatusAction,
  convertQuotationToInvoiceAction,
  deleteQuotationAction,
  duplicateQuotationAction,
} from "@/lib/actions/quotations";
import { convertQuotationToOrderAction } from "@/lib/actions/orders";
import type { QuotationStatus } from "@prisma/client";

export function QuotationActions({
  id,
  status,
  hasConvertedInvoice,
}: {
  id: string;
  number?: string;
  status: QuotationStatus;
  hasConvertedInvoice?: boolean;
  doc?: unknown;
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
    <div className="flex flex-wrap items-center gap-2 print-hide">
      {status !== "CONVERTED" && (
        <Button asChild variant="outline">
          <Link href={`/quotations/${id}/edit`}>
            <Pencil className="size-4" /> Edit
          </Link>
        </Button>
      )}

      <Button variant="outline" onClick={duplicate} disabled={pending}>
        <Copy className="size-4" /> Duplicate
      </Button>

      {status === "DRAFT" && (
        <Button onClick={() => setStatus("SENT")} disabled={pending}>
          <Send className="size-4" /> Mark as Sent
        </Button>
      )}

      {status === "SENT" && (
        <>
          <Button onClick={() => setStatus("ACCEPTED")} disabled={pending}>
            <CheckCircle2 className="size-4" /> Mark as Accepted
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-950/30" disabled={pending}>
                <XCircle className="size-4 text-red-600 dark:text-red-400 mr-1.5" /> Mark as Rejected
              </Button>
            }
            title="Mark as Rejected?"
            description="The customer declined this quotation. You can reopen it later if needed."
            confirmLabel="Mark Rejected"
            onConfirm={async () => {
              const result = await changeQuotationStatusAction(id, "REJECTED");
              if (result.success) router.refresh();
              return result;
            }}
          />
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
            <Button
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/40"
              disabled={pending}
            >
              <Trash2 className="size-4 text-red-600 dark:text-red-400 mr-1.5" /> Delete
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
