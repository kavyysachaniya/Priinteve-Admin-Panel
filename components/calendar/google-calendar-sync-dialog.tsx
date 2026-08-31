"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function GoogleCalendarSyncDialog() {
  const [copied, setCopied] = useState(false);

  const getFeedUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/calendar/feed`;
    }
    return "/api/calendar/feed";
  };

  const handleCopy = () => {
    const url = getFeedUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Calendar feed link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenGoogleCalendar = () => {
    window.open("https://calendar.google.com/calendar/u/0/r/settings/addbyurl", "_blank");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
          <CalendarIcon className="size-3.5 text-primary" />
          <span>Sync Google Calendar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <CalendarIcon className="size-4 text-primary" />
            Sync with Google Calendar
          </DialogTitle>
          <DialogDescription className="text-xs">
            Subscribe to your live Priinteve schedule (events, order deadlines, deliveries, and tasks) in Google Calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Feed URL Box */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Your Live Calendar Feed URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? getFeedUrl() : "/api/calendar/feed"}
                className="w-full rounded-md border bg-muted px-3 py-1.5 text-xs font-mono select-all text-foreground"
              />
              <Button size="sm" variant="secondary" onClick={handleCopy} className="shrink-0 gap-1">
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Step by Step Instructions */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <p className="font-semibold text-foreground">How to sync in 3 steps:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-[11px]">
              <li>Click <strong>Copy</strong> on your Feed URL above.</li>
              <li>Click <strong>Open Google Calendar</strong> below.</li>
              <li>Paste the link into <strong>&quot;URL of calendar&quot;</strong> and click <strong>&quot;Add calendar&quot;</strong>.</li>
            </ol>
          </div>

          {/* Action Button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={handleOpenGoogleCalendar}
              className="gap-1.5 w-full sm:w-auto"
            >
              <span>Open Google Calendar</span>
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
