"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { revokeCompanionDeviceAction } from "@/lib/actions/companion";

export function RevokeDeviceItem({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          Revoke
        </Button>
      }
      title="Revoke this computer?"
      description={`"${deviceName}" will stop receiving briefings straight away. You can pair it again with a new token.`}
      confirmLabel="Revoke"
      onConfirm={async () => {
        const result = await revokeCompanionDeviceAction(deviceId);
        return result.success ? { success: true, message: "Device revoked" } : result;
      }}
    />
  );
}
