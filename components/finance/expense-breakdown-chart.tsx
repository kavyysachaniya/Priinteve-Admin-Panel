"use client";

import { formatCurrency } from "@/lib/money";

export function ExpenseBreakdownChart({
  categories = [],
}: {
  categories?: Array<{ id: string; name: string; totalPaise: number }>;
}) {
  if (!categories || categories.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-4">No recorded expenses by category yet.</p>;
  }

  const grandTotal = categories.reduce((sum, c) => sum + c.totalPaise, 0);

  return (
    <div className="space-y-3">
      {categories.slice(0, 6).map((cat) => {
        const pct = grandTotal > 0 ? Math.round((cat.totalPaise / grandTotal) * 100) : 0;
        return (
          <div key={cat.id} className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{cat.name}</span>
              <span className="font-semibold">{formatCurrency(cat.totalPaise)} ({pct}%)</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--chart-4)] transition-all duration-300"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

