"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteVendorAction } from "@/lib/actions/vendors";

export function DeleteVendorItem({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Delete vendor" />}
      title="Delete this vendor?"
      description={`This can't be undone. "${vendorName}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteVendorAction(vendorId)}
    />
  );
}
