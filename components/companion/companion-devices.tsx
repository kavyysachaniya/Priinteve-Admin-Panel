"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Laptop } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RevokeDeviceItem } from "@/components/companion/revoke-device-item";
import { createCompanionDeviceAction } from "@/lib/actions/companion";
import { formatDate } from "@/lib/format";

export interface DeviceView {
  id: string;
  name: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function CompanionDevices({ devices, appUrl }: { devices: DeviceView[]; appUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function createDevice(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await createCompanionDeviceAction({ name });
    setPending(false);
    if (!result.success || !result.message) {
      toast.error(result.success ? "Couldn't create the device." : result.message);
      return;
    }
    setToken(result.message);
    setName("");
    router.refresh();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5" id="devices">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Your computers</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pair the desktop app: create a device here, then paste its token in the app (tray icon → Open settings) with the
          panel address <span className="font-mono">{appUrl}</span>.
        </p>
      </div>

      {devices.length > 0 && (
        <ul className="mb-4 divide-y rounded-md border">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Laptop className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{device.name}</p>
                <p className="text-xs text-muted-foreground">
                  Added {formatDate(device.createdAt)}
                  {device.lastSeenAt ? ` · last briefing ${formatDate(device.lastSeenAt)}` : " · not used yet"}
                </p>
              </div>
              {device.revokedAt ? (
                <Badge variant="outline">Revoked</Badge>
              ) : (
                <RevokeDeviceItem deviceId={device.id} deviceName={device.name} />
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={createDevice} className="flex flex-wrap gap-2">
        <Input
          aria-label="Computer name"
          placeholder="Office desktop"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Creating…" : "Create device token"}
        </Button>
      </form>

      <Dialog open={token !== null} onOpenChange={(open) => !open && setToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Device token</DialogTitle>
            <DialogDescription>
              Paste this into the desktop app now. It won&apos;t be shown again; if you lose it, revoke the device and create a
              new one. Treat it like a password.
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-md bg-muted p-3 text-xs">{token}</code>
          <DialogFooter>
            <Button variant="outline" onClick={() => token && copy(token)}>
              <Copy className="size-4" /> Copy token
            </Button>
            <Button onClick={() => setToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
