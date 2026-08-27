"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteCustomerAction } from "@/lib/actions/customers";

// A Server Component can't pass an event handler (onSelect) or a plain
// closure (onConfirm) as a prop across the RSC boundary — only a plain
// serializable id can cross. So this whole interactive unit lives in its own
// Client Component, and the delete closure is built here, not in the caller.
export function DeleteCustomerItem({ customerId, customerName }: { customerId: string; customerName: string }) {
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      }
      title="Delete this customer?"
      description={`This can't be undone. "${customerName}" can only be deleted if it has no quotations, invoices, or payments on record — mark it Inactive otherwise.`}
      confirmLabel="Delete"
      onConfirm={() => deleteCustomerAction(customerId)}
    />
  );
}
