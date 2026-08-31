"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteTaskAction } from "@/lib/actions/tasks";

export function DeleteTaskItem({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Delete task" />}
      title="Delete this task?"
      description={`This can't be undone. "${taskTitle}" will be permanently removed.`}
      confirmLabel="Delete"
      onConfirm={() => deleteTaskAction(taskId)}
    />
  );
}
