"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteTaskAction } from "@/lib/actions/tasks";

export function DeleteTaskItem({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      }
      title="Delete this task?"
      description={`This can't be undone. "${taskTitle}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteTaskAction(taskId)}
    />
  );
}
