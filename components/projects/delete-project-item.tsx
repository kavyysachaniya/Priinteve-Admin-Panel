"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteProjectAction } from "@/lib/actions/projects";

export function DeleteProjectItem({
  projectId,
  projectName,
  trigger,
}: {
  projectId: string;
  projectName: string;
  trigger?: React.ReactNode;
}) {
  return (
    <ConfirmDialog
      trigger={trigger ?? <DeleteRowButton label="Delete project" />}
      title="Delete Project?"
      description={`This will permanently remove the project "${projectName}" and its associated time entries.`}
      confirmLabel="Delete Project"
      destructive
      onConfirm={() => deleteProjectAction(projectId)}
    />
  );
}
