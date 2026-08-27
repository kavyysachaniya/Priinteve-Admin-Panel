"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteProductAction } from "@/lib/actions/products";

export function DeleteProductItem({ productId, productName }: { productId: string; productName: string }) {
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      }
      title="Delete this product?"
      description={`This can't be undone. "${productName}" can only be deleted if it isn't used in any quotation or invoice — mark it Inactive otherwise.`}
      confirmLabel="Delete"
      onConfirm={() => deleteProductAction(productId)}
    />
  );
}
