import Link from "next/link";
import { Download, MonitorDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard strip offering the Windows time tracker. The download itself goes through
 * /api/companion/installer, which re-checks `companion:use` and hands out a short-lived link.
 */
export function DesktopAppCard({ version, sizeBytes }: { version: string | null; sizeBytes: number | null }) {
  const size = sizeBytes ? `${(sizeBytes / (1024 * 1024)).toFixed(0)} MB` : null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3 sm:flex-1">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <MonitorDown className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">
            Priinteve Time Tracker for Windows
            {version && <span className="ml-2 text-xs font-normal text-muted-foreground">v{version}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            Track time on your tasks from the desktop, even offline. It reminds you to stop your timer before the PC shuts down.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/companion">Set up</Link>
        </Button>
        <Button size="sm" asChild>
          <a href="/api/companion/installer">
            <Download className="size-4" /> Download{size ? ` (${size})` : ""}
          </a>
        </Button>
      </div>
    </div>
  );
}
