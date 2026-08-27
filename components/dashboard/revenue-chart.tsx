"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRevenueSeriesAction } from "@/lib/actions/dashboard";
import { formatCurrency } from "@/lib/money";
import type { RevenueRange } from "@/lib/services/dashboard";

type SeriesPoint = { label: string; revenuePaise: number; expensesPaise: number };

const RANGE_OPTIONS: { value: RevenueRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

export function RevenueChart({ initialData }: { initialData: SeriesPoint[] }) {
  const [range, setRange] = useState<RevenueRange>("30d");
  const [data, setData] = useState(initialData);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const next = await getRevenueSeriesAction(range);
      setData(next);
    });
  }, [range]);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Revenue vs Expenses</h3>
          <div className="mt-1.5 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2 rounded-full" style={{ background: "var(--chart-revenue)" }} />
              Revenue
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2 rounded-full" style={{ background: "var(--chart-expenses)" }} />
              Expenses
            </span>
          </div>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as RevenueRange)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-revenue)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-revenue)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expensesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-expenses)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-expenses)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              minTickGap={20}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v) => formatCurrency(v, { decimals: false })}
              width={70}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 font-medium text-popover-foreground">{label}</p>
                    {payload.map((entry) => (
                      <div key={entry.dataKey as string} className="flex items-center gap-1.5 text-popover-foreground/80">
                        <span className="inline-block size-1.5 rounded-full" style={{ background: entry.color }} />
                        {entry.dataKey === "revenuePaise" ? "Revenue" : "Expenses"}: {formatCurrency(Number(entry.value))}
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="revenuePaise"
              stroke="var(--chart-revenue)"
              strokeWidth={2}
              fill="url(#revenueFill)"
            />
            <Area
              type="monotone"
              dataKey="expensesPaise"
              stroke="var(--chart-expenses)"
              strokeWidth={2}
              fill="url(#expensesFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
