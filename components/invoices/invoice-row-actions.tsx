"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Ban } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { markInvoiceSentAction, cancelInvoiceAction } from "@/lib/actions/invoices";
import type { InvoiceStatus } from "@prisma/client";

/**
 * Mirrors components/invoices/invoice-actions.tsx (the detail-page toolbar)
 * for the list's overflow menu — same server actions, no new behavior.
 * There is no delete action for invoices (only cancel); none is added here.
 */
export function InvoiceRowActions({ id, status }: { id: string; status: InvoiceStatus }) {
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

  return (
    <>
      {status === "DRAFT" && (
        <DropdownMenuItem disabled={pending} onSelect={markSent}>
          <Send className="size-4" /> Mark as Sent
        </DropdownMenuItem>
      )}
      {status !== "CANCELLED" && (
        <ConfirmDialog
          trigger={
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={(e) => e.preventDefault()}
            >
              <Ban className="size-4" /> Cancel Invoice
            </DropdownMenuItem>
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
    </>
  );
}
