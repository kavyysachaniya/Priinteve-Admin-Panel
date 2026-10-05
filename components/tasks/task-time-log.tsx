import { Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { formatDuration } from "@/lib/time-format";
import type { TaskTimeSummary } from "@/lib/services/tasks";

/**
 * Time logged on a task: the total, the last stopped timer, and every entry. Shown to staff as
 * soon as a timer stops (no approval step). Server component: it only renders what it's given.
 */
export function TaskTimeLog({ summary }: { summary: TaskTimeSummary }) {
  const { entries, totalSeconds, last } = summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <Timer className="size-3.5" /> Time on this task
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {entries.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">No time logged yet. Start the timer to track work on this task.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="font-mono text-lg font-semibold tabular-nums">{formatDuration(totalSeconds)}</span>
            </div>
            {last && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Last timer: </span>
                <span className="font-medium">{formatDuration(last.seconds)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  by {last.userName}, {formatDateTime(last.endedAt ?? last.startedAt)}
                </span>
              </p>
            )}
            <ul className="divide-y rounded-md border text-xs">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.userName}</p>
                    <p className="text-muted-foreground">{formatDateTime(entry.startedAt)}</p>
                  </div>
                  {entry.running ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Running · {formatDuration(entry.seconds)}
                    </span>
                  ) : (
                    <span className="font-mono tabular-nums">{formatDuration(entry.seconds)}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
