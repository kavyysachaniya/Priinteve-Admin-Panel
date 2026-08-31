"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteQuotationAction } from "@/lib/actions/quotations";
import type { QuotationStatus } from "@prisma/client";

// Only DRAFT quotations can be deleted (deleteQuotationAction enforces this
// server-side too — see lib/services/quotations.ts) so this renders nothing
// otherwise, matching the same guard used on the quotation detail page.
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
      trigger={
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      }
      title="Delete this quotation?"
      description={`This can't be undone. "${number}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteQuotationAction(id)}
    />
  );
}
