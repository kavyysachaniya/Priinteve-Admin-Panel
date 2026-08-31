"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteVendorAction } from "@/lib/actions/vendors";

export function DeleteVendorItem({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      }
      title="Delete this vendor?"
      description={`This can't be undone. "${vendorName}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteVendorAction(vendorId)}
    />
  );
}
