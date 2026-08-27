import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { AttentionItem } from "@/lib/services/dashboard";

export function NeedsAttention({
  overdueInvoices,
  pendingQuotations,
  unpaidInvoices,
  recentInvoices,
}: {
  overdueInvoices: AttentionItem[];
  pendingQuotations: AttentionItem[];
  unpaidInvoices: AttentionItem[];
  recentInvoices: AttentionItem[];
}) {
  const groups = [
    { title: "Overdue Invoices", items: overdueInvoices, tone: "text-destructive" },
    { title: "Pending Quotations", items: pendingQuotations, tone: "text-warning-foreground" },
    { title: "Unpaid Invoices", items: unpaidInvoices, tone: "text-foreground" },
    { title: "Recently Created, Awaiting Payment", items: recentInvoices, tone: "text-muted-foreground" },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">Needs Attention</h3>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="mb-2 size-6 text-success" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <span className="min-w-0 truncate">{item.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {item.subtitle}
                        <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
