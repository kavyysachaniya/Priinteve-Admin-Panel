"use client";

import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { formatHms } from "@/lib/timesheet";

interface Snapshot {
  startedAt?: string;
  endedAt?: string | null;
  durationSeconds?: number;
  status?: string;
  lastHeartbeatAt?: string | null;
}

interface Correction {
  id: string;
  action: string;
  reason: string;
  before: Snapshot;
  after: Snapshot | null;
  createdAt: string;
  changedBy: { name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  EDIT: "Edited",
  DELETE: "Deleted",
  RECOVERY: "Interrupted session closed",
};

function describe(s: Snapshot | null) {
  if (!s) return "—";
  const parts = [
    s.startedAt ? formatDateTime(s.startedAt) : null,
    s.endedAt ? `→ ${formatDateTime(s.endedAt)}` : s.endedAt === null ? "→ running" : null,
    typeof s.durationSeconds === "number" ? `(${formatHms(s.durationSeconds)})` : null,
  ];
  return parts.filter(Boolean).join(" ");
}

/** Opens the audit trail of one time entry: who changed it, when, why, and the values before and after. */
export function EntryHistoryButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Correction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    setError(null);
    try {
      const res = await fetch(`/api/time-entries/${entryId}/corrections`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load the history.");
      setItems(data.corrections as Correction[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the history.");
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="size-7" onClick={load} title="Correction history" aria-label="Correction history">
        <History className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Correction history</DialogTitle>
            <DialogDescription>Every change to this entry, with the values before and after.</DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : items === null ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">This entry has never been corrected.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {items.map((c) => (
                <li key={c.id} className="rounded-md border p-3">
                  <p className="font-medium">
                    {ACTION_LABELS[c.action] ?? c.action} by {c.changedBy?.name ?? "someone"}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">“{c.reason}”</p>
                  <p className="mt-2 text-xs">
                    <span className="text-muted-foreground">Before: </span>
                    {describe(c.before)}
                  </p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">After: </span>
                    {describe(c.after)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
