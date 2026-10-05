"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import { deleteGmailAccountAction } from "@/lib/actions/companion";

export function RemoveAccountItem({ accountId, accountName }: { accountId: string; accountName: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Remove Gmail account" />}
      title={`Remove ${accountName}?`}
      description="The companion stops checking this account and its stored access is deleted. To fully revoke access, also remove the app from your Google account's third-party connections."
      confirmLabel="Remove"
      onConfirm={async () => {
        const result = await deleteGmailAccountAction(accountId);
        return result.success ? { success: true, message: "Account removed" } : result;
      }}
    />
  );
}
