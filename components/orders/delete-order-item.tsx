"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteOrderAction } from "@/lib/actions/orders";

export function DeleteOrderItem({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Delete order" />}
      title="Delete this order?"
      description={`This can't be undone. Order "${orderNumber}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteOrderAction(orderId)}
    />
  );
}
