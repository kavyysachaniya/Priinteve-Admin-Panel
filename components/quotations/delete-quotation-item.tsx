"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteQuotationAction } from "@/lib/actions/quotations";
import type { QuotationStatus } from "@prisma/client";

export function DeleteQuotationItem({
  id,
  number,
  status,
}: {
  id: string;
  number: string;
  status: QuotationStatus;
}) {
  if (status !== "DRAFT") return null;

  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Delete quotation" />}
      title="Delete this quotation?"
      description={`This can't be undone. "${number}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteQuotationAction(id)}
    />
  );
}
