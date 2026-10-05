"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RemoveAccountItem } from "@/components/companion/remove-account-item";
import { updateGmailAccountAction } from "@/lib/actions/companion";
import type { FormActionResult } from "@/lib/actions/utils";

export interface GmailAccountView {
  id: string;
  label: string;
  email: string;
  enabled: boolean;
  excludeFromProcessing: boolean;
  status: "CONNECTED" | "NEEDS_RECONNECT";
}

function useAccountUpdate() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<FormActionResult>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }
  return { pending, run };
}

function StatusBadge({ status }: { status: "CONNECTED" | "NEEDS_RECONNECT" }) {
  return status === "CONNECTED" ? (
    <Badge variant="secondary">Connected</Badge>
  ) : (
    <Badge variant="destructive">Reconnect needed</Badge>
  );
}

/** A plain GET form: the connect route redirects the browser to Google. */
function ConnectForm({ href, placeholder, buttonLabel, disabled }: { href: string; placeholder: string; buttonLabel: string; disabled?: boolean }) {
  return (
    <form action={href} method="get" className="flex flex-wrap gap-2">
      <Input name="label" aria-label="Label" placeholder={`Label, e.g. ${placeholder}`} maxLength={40} className="max-w-xs" />
      <Button type="submit" variant="outline" disabled={disabled}>
        {buttonLabel}
      </Button>
    </form>
  );
}

export function GmailAccounts({ accounts, configured }: { accounts: GmailAccountView[]; configured: boolean }) {
  const { pending, run } = useAccountUpdate();
  return (
    <div className="rounded-lg border bg-card p-5" id="gmail">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Gmail accounts</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Read-only access: unread count, yesterday&apos;s important mail and the top emails to look at. Nothing is ever sent
          or changed. Mark an inbox <strong>private</strong> to report counts only.
          {!configured && " Gmail isn't configured on the server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)."}
        </p>
      </div>

      {accounts.length > 0 && (
        <ul className="mb-4 divide-y rounded-md border">
          {accounts.map((account) => (
            <li key={account.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{account.label}</p>
                <p className="truncate text-xs text-muted-foreground">{account.email}</p>
              </div>
              <StatusBadge status={account.status} />
              <label className="flex items-center gap-1.5 text-xs">
                <Switch
                  size="sm"
                  checked={account.enabled}
                  disabled={pending}
                  onCheckedChange={(enabled) =>
                    run(() => updateGmailAccountAction({ id: account.id, enabled }), enabled ? "Account on" : "Account off")
                  }
                />
                On
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch
                  size="sm"
                  checked={account.excludeFromProcessing}
                  disabled={pending}
                  onCheckedChange={(excludeFromProcessing) =>
                    run(
                      () => updateGmailAccountAction({ id: account.id, excludeFromProcessing }),
                      excludeFromProcessing ? "Counts only for this inbox" : "Ranking turned on",
                    )
                  }
                />
                Private
              </label>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/api/companion/google/connect?label=${encodeURIComponent(account.label)}&email=${encodeURIComponent(account.email)}`}
                >
                  Reconnect
                </a>
              </Button>
              <RemoveAccountItem accountId={account.id} accountName={account.email} />
            </li>
          ))}
        </ul>
      )}

      <ConnectForm href="/api/companion/google/connect" placeholder="Work" buttonLabel="Connect Gmail" disabled={!configured} />
    </div>
  );
}
