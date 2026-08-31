"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteProductAction } from "@/lib/actions/products";

export function DeleteProductItem({ productId, productName }: { productId: string; productName: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Delete product" />}
      title="Delete this product?"
      description={`This can't be undone. "${productName}" can only be deleted if it isn't used in any quotation or invoice — mark it Inactive otherwise.`}
      confirmLabel="Delete"
      onConfirm={() => deleteProductAction(productId)}
    />
  );
}
