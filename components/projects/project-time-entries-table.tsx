"use client";

import { Clock, User as UserIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatTime, formatDuration } from "@/lib/time-format";
import type { TimeEntryStatus } from "@prisma/client";

interface TimeEntryItem {
  id: string;
  startedAt: Date | string;
  endedAt: Date | string | null;
  durationSeconds: number;
  status: TimeEntryStatus;
  notes?: string | null;
  user?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
}

export function ProjectTimeEntriesTable({
  entries,
  totalDurationSeconds,
}: {
  entries: TimeEntryItem[];
  totalDurationSeconds: number;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground">
        <Clock className="size-8 mx-auto mb-2 text-muted-foreground/60" />
        <p className="font-semibold text-foreground text-sm mb-1">No Time Entries Recorded</p>
        <p>Start the project timer to begin tracking work sessions.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Ended</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Team Member</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isRunning = entry.status === "RUNNING";
            return (
              <TableRow key={entry.id} className="text-xs">
                {/* Date */}
                <TableCell className="font-medium text-foreground whitespace-nowrap">
                  {formatDate(entry.startedAt)}
                </TableCell>

                {/* Started */}
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatTime(entry.startedAt)}
                </TableCell>

                {/* Ended */}
                <TableCell className="whitespace-nowrap">
                  {isRunning ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Running…
                    </span>
                  ) : entry.endedAt ? (
                    <span className="text-muted-foreground">{formatTime(entry.endedAt)}</span>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </TableCell>

                {/* Duration */}
                <TableCell className="font-mono font-semibold tabular-nums text-foreground whitespace-nowrap">
                  {isRunning ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Live</span>
                  ) : (
                    formatDuration(entry.durationSeconds)
                  )}
                </TableCell>

                {/* User */}
                <TableCell className="text-foreground whitespace-nowrap">
                  {entry.user ? (
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <UserIcon className="size-3 text-muted-foreground" />
                      {entry.user.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">System / Unknown</span>
                  )}
                </TableCell>

                {/* Notes */}
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {entry.notes || <span className="italic text-muted-foreground/60">—</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Auditability Summary Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t text-xs">
        <span className="text-muted-foreground">
          Showing <strong className="text-foreground">{entries.length}</strong> recorded session{entries.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Total Time:</span>
          <span className="font-mono text-sm font-bold text-primary tabular-nums">
            {formatDuration(totalDurationSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}
