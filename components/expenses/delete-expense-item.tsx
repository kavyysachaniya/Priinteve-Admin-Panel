"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteExpenseAction } from "@/lib/actions/expenses";

export function DeleteExpenseItem({ expenseId, expenseNumber }: { expenseId: string; expenseNumber: string }) {
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      }
      title="Delete this expense?"
      description={`This can't be undone. "${expenseNumber}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteExpenseAction(expenseId)}
    />
  );
}
