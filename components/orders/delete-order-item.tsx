"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteOrderAction } from "@/lib/actions/orders";

export function DeleteOrderItem({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      }
      title="Delete this order?"
      description={`This can't be undone. Order "${orderNumber}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteOrderAction(orderId)}
    />
  );
}
