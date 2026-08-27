import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/money";
import { initials } from "@/lib/format";
import type { TopCustomer } from "@/lib/services/finance";

export function TopCustomers({ customers }: { customers: TopCustomer[] }) {
  if (customers.length === 0) {
    return <EmptyState title="No revenue yet" description="Top customers by business will appear once invoices are paid." />;
  }

  const max = Math.max(...customers.map((c) => c.totalBusinessPaise));

  return (
    <ul className="space-y-3">
      {customers.map((customer, idx) => (
        <li key={customer.id}>
          <Link href={`/customers/${customer.id}`} className="group flex items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {idx + 1}
            </span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(customer.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium group-hover:underline">{customer.name}</p>
                <p className="shrink-0 text-sm font-medium">{formatCurrency(customer.totalBusinessPaise)}</p>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${max > 0 ? (customer.totalBusinessPaise / max) * 100 : 0}%` }}
                />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
