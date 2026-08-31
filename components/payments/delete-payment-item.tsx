"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deletePaymentAction } from "@/lib/actions/payments";

export function DeletePaymentItem({ paymentId }: { paymentId: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Delete payment" />}
      title="Delete this payment?"
      description="The invoice's outstanding balance and status will be recalculated. This can't be undone."
      confirmLabel="Delete"
      onConfirm={() => deletePaymentAction(paymentId)}
    />
  );
}
