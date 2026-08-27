"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deletePaymentAction } from "@/lib/actions/payments";

export function DeletePaymentItem({ paymentId }: { paymentId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      }
      title="Delete this payment?"
      description="The invoice's outstanding balance and status will be recalculated. This can't be undone."
      confirmLabel="Delete"
      onConfirm={() => deletePaymentAction(paymentId)}
    />
  );
}
