"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Send, CheckCircle2, XCircle, ArrowRightLeft, ShoppingBag } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  changeQuotationStatusAction,
  convertQuotationToInvoiceAction,
  duplicateQuotationAction,
} from "@/lib/actions/quotations";
import { convertQuotationToOrderAction } from "@/lib/actions/orders";
import type { QuotationStatus } from "@prisma/client";

/**
 * The status/convert/duplicate actions for a quotation, adapted for the list
 * page's overflow menu. Calls the exact same server actions as
 * components/quotations/quotation-actions.tsx (the detail-page toolbar) —
 * no business logic is duplicated, only the presentation differs (menu items
 * here vs. buttons there).
 */
export function QuotationRowActions({ id, status }: { id: string; status: QuotationStatus }) {
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

  function convertToInvoice() {
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

  function convertToOrder() {
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
    <>
      {status === "DRAFT" && (
        <DropdownMenuItem disabled={pending} onSelect={() => setStatus("SENT")}>
          <Send className="size-4" /> Mark as Sent
        </DropdownMenuItem>
      )}
      {status === "SENT" && (
        <>
          <DropdownMenuItem disabled={pending} onSelect={() => setStatus("ACCEPTED")}>
            <CheckCircle2 className="size-4" /> Mark as Accepted
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => setStatus("REJECTED")}>
            <XCircle className="size-4" /> Mark as Rejected
          </DropdownMenuItem>
        </>
      )}
      {status === "ACCEPTED" && (
        <>
          <DropdownMenuItem disabled={pending} onSelect={convertToInvoice}>
            <ArrowRightLeft className="size-4" /> Convert to Invoice
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending} onSelect={convertToOrder}>
            <ShoppingBag className="size-4" /> Book Print Order
          </DropdownMenuItem>
        </>
      )}
      <DropdownMenuItem disabled={pending} onSelect={duplicate}>
        <Copy className="size-4" /> Duplicate
      </DropdownMenuItem>
    </>
  );
}
