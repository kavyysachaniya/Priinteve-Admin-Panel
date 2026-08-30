"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reverseJournalEntryAction } from "@/lib/actions/journal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function JournalReversalButton({
  journalId,
  journalNumber,
}: {
  journalId: string;
  journalNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const handleReversal = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for the reversal.");
      return;
    }

    setLoading(true);
    const res = await reverseJournalEntryAction(journalId, reason);
    setLoading(false);

    if (res.success) {
      toast.success("Journal entry reversed successfully");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.message || "Failed to reverse journal entry");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="flex items-center gap-1">
          <RefreshCw className="size-3.5" /> Reverse Journal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reverse Journal Entry</DialogTitle>
          <DialogDescription>
            This will create a new posted journal entry reversing all debits and credits of {journalNumber}. The original entry remains in the system for audit trails.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Reason for Reversal</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Incorrect account mapping / keying error"
              rows={3}
              className="text-xs border rounded p-2.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleReversal} disabled={loading}>
            {loading ? "Reversing..." : "Confirm Reversal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
