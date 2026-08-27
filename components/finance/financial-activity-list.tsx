"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

export function FinancialActivityList({
  items = [],
}: {
  items?: Array<{
    id: string;
    date: Date;
    type: "inflow" | "outflow";
    title: string;
    categoryOrCustomer: string;
    amountPaise: number;
    href: string;
  }>;
}) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-4">No recent financial transactions recorded.</p>;
  }

  return (
    <div className="divide-y rounded-lg border bg-card text-xs">
      {items.map((item) => {
        const isInflow = item.type === "inflow";
        return (
          <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <span
                className={cn(
                  "p-1.5 rounded-full shrink-0",
                  isInflow ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
                )}
              >
                {isInflow ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
              </span>
              <div className="min-w-0">
                <Link href={item.href} className="font-semibold text-foreground hover:underline block truncate">
                  {item.title}
                </Link>
                <p className="text-[11px] text-muted-foreground truncate">
                  {item.categoryOrCustomer} • {format(new Date(item.date), "d MMM yyyy")}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={cn("font-bold text-sm", isInflow ? "text-emerald-600" : "text-rose-600")}>
                {isInflow ? "+" : "-"} {formatCurrency(item.amountPaise)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

