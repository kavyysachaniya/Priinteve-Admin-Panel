"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteCustomerAction } from "@/lib/actions/customers";

export function DeleteCustomerItem({ customerId, customerName }: { customerId: string; customerName: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Delete customer" />}
      title="Delete this customer?"
      description={`This can't be undone. "${customerName}" can only be deleted if it has no quotations, invoices, or payments on record — mark it Inactive otherwise.`}
      confirmLabel="Delete"
      onConfirm={() => deleteCustomerAction(customerId)}
    />
  );
}
