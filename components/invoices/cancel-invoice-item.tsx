"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { cancelInvoiceAction } from "@/lib/actions/invoices";
import type { InvoiceStatus } from "@prisma/client";

export function CancelInvoiceItem({ id, status }: { id: string; status: InvoiceStatus }) {
  const router = useRouter();
  if (status === "CANCELLED") return null;

  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Cancel Invoice" />}
      title="Cancel this invoice?"
      description="Cancelled invoices are excluded from revenue and outstanding totals. This can't be undone."
      confirmLabel="Cancel Invoice"
      onConfirm={async () => {
        const result = await cancelInvoiceAction(id);
        if (result.success) router.refresh();
        return result;
      }}
    />
  );
}
