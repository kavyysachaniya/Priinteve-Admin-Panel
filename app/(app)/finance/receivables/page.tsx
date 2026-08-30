import { PageHeader } from "@/components/shared/page-header";
import { getReceivables } from "@/lib/services/accounting/reports";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";

export const metadata = { title: "Receivables Aging — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  try {
    await requirePermission("finance:view");
  } catch {
    redirect("/dashboard");
  }

  const receivables = await getReceivables();

  // Aggregate stats
  const totalReceivables = receivables.reduce((sum, c) => sum + c.outstandingPaise, 0);
  const totalOverdue = receivables.reduce((sum, c) => {
    return sum + c.items.reduce((s, item) => s + (item.daysOverdue > 0 ? item.outstandingPaise : 0), 0);
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Receivable (A/R)"
        description="Track all customer invoice outstanding balances, payments, and overdue durations."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Wallet className="size-3.5" />
            Total Outstanding Receivables
          </p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(totalReceivables)}</p>
        </Card>
        <Card className="p-4 space-y-1 border-amber-255/20 bg-amber-500/5">
          <p className="text-xs text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Overdue Balance
          </p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(totalOverdue)}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            Active Customer Accounts
          </p>
          <p className="text-lg font-bold text-foreground">{receivables.length}</p>
        </Card>
      </div>

      {/* Customer Summaries */}
      <div className="space-y-6">
        {receivables.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground italic">
            No outstanding customer accounts receivable.
          </div>
        ) : (
          receivables.map((customer) => (
            <div key={customer.customerId} className="rounded-lg border bg-card overflow-hidden">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b px-5 py-3.5 bg-muted/20 gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    <Link href={`/customers/${customer.customerId}`} className="hover:underline text-primary">
                      {customer.customerName}
                    </Link>
                  </h3>
                  <p className="text-[10px] text-muted-foreground uppercase">Customer Account Summary</p>
                </div>
                <div className="flex gap-4 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px] font-sans">Total Invoiced</span>
                    <span className="font-semibold">{formatCurrency(customer.totalPaise)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px] font-sans">Total Paid</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(customer.paidPaise)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px] font-sans">Outstanding</span>
                    <span className="font-bold text-foreground">{formatCurrency(customer.outstandingPaise)}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Invoice #</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="w-[100px] text-center">Days Overdue</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.items.map((item) => (
                    <TableRow key={item.invoiceId}>
                      <TableCell className="font-semibold text-xs text-primary hover:underline">
                        <Link href={`/invoices/${item.invoiceId}`}>{item.invoiceNumber}</Link>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(item.invoiceDate)}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.dueDate)}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{formatCurrency(item.totalPaise)}</TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 font-medium">{formatCurrency(item.paidPaise)}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-foreground">{formatCurrency(item.outstandingPaise)}</TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {item.daysOverdue > 0 ? (
                          <span className="text-red-500 font-bold">{item.daysOverdue} days</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.status === "OVERDUE"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}>
                          {item.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
