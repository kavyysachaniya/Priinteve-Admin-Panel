import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  changeLabel,
  changeDirection,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  /** e.g. "+12.5% from last month" */
  changeLabel?: string;
  changeDirection?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {changeLabel && (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-xs font-medium",
            changeDirection === "up" && "text-success",
            changeDirection === "down" && "text-destructive",
            changeDirection === "neutral" && "text-muted-foreground"
          )}
        >
          {changeDirection === "up" && <ArrowUpRight className="size-3.5" />}
          {changeDirection === "down" && <ArrowDownRight className="size-3.5" />}
          {changeLabel}
        </p>
      )}
    </div>
  );
}
