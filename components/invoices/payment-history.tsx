import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PaymentMethodBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";
import type { Payment } from "@prisma/client";

export function PaymentHistory({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return <EmptyState icon={Wallet} title="No payments recorded" description="Payments made against this invoice will show up here." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="text-sm">{formatDate(p.paymentDate)}</TableCell>
              <TableCell><PaymentMethodBadge method={p.method} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.referenceNumber || "—"}</TableCell>
              <TableCell className="text-right text-sm font-medium">{formatCurrency(p.amountPaise)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
