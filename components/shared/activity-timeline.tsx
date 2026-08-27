import { Activity } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/format";
import type { ActivityLog } from "@prisma/client";

export function ActivityTimeline({ items }: { items: ActivityLog[] }) {
  if (items.length === 0) {
    return <EmptyState icon={Activity} title="No activity yet" description="Actions on this record will show up here." />;
  }

  return (
    <ol className="space-y-0">
      {items.map((item, idx) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          {idx !== items.length - 1 && (
            <span className="absolute top-2 left-[7px] h-full w-px bg-border" aria-hidden />
          )}
          <span className="relative mt-1.5 size-[15px] shrink-0 rounded-full border-2 border-primary bg-background" />
          <div className="min-w-0 pb-0.5">
            <p className="text-sm">{item.message}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
