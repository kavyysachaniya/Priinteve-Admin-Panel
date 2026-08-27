import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QuotationStatusBadge, InvoiceStatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";
import type { RecentTransaction } from "@/lib/services/dashboard";
import type { QuotationStatus, InvoiceStatus } from "@prisma/client";

export function RecentTransactions({ transactions }: { transactions: RecentTransaction[] }) {
  if (transactions.length === 0) {
    return <EmptyState title="No transactions yet" description="Quotations, invoices, and payments will show up here." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={`${tx.type}-${tx.id}`}>
              <TableCell className="text-sm text-muted-foreground">{formatDate(tx.date)}</TableCell>
              <TableCell className="text-sm">{tx.customer}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">{tx.type}</Badge>
              </TableCell>
              <TableCell>
                <Link href={tx.href} className="text-sm font-medium text-primary hover:underline">
                  {tx.reference}
                </Link>
              </TableCell>
              <TableCell className="text-right text-sm font-medium">{formatCurrency(tx.amountPaise)}</TableCell>
              <TableCell>
                {tx.type === "Quotation" && <QuotationStatusBadge status={tx.status as QuotationStatus} />}
                {tx.type === "Invoice" && <InvoiceStatusBadge status={tx.status as InvoiceStatus} />}
                {tx.type === "Payment" && <Badge className="border-transparent bg-success/15 text-success">Received</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
