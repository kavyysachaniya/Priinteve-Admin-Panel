"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteExpenseAction } from "@/lib/actions/expenses";

export function DeleteExpenseItem({ expenseId, expenseNumber }: { expenseId: string; expenseNumber: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Delete expense" />}
      title="Delete this expense?"
      description={`This can't be undone. "${expenseNumber}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteExpenseAction(expenseId)}
    />
  );
}
