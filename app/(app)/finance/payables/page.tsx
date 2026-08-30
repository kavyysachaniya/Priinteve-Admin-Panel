import { PageHeader } from "@/components/shared/page-header";
import { getPayables } from "@/lib/services/accounting/reports";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Store, ArrowDownRight } from "lucide-react";

export const metadata = { title: "Payables Overview — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function PayablesPage() {
  try {
    await requirePermission("finance:view");
  } catch {
    redirect("/dashboard");
  }

  const payables = await getPayables();

  // Aggregate stats
  const totalPayables = payables.reduce((sum, v) => sum + v.outstandingPaise, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Payable (A/P)"
        description="Monitor what Priinteve owes vendors for recorded material purchases and operating expenses."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ArrowDownRight className="size-3.5 text-red-500" />
            Total Outstanding Payables
          </p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(totalPayables)}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Store className="size-3.5 text-muted-foreground" />
            Active Vendors Owed
          </p>
          <p className="text-lg font-bold text-foreground">{payables.length}</p>
        </Card>
      </div>

      {/* Vendor Summaries */}
      <div className="space-y-6">
        {payables.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground italic">
            No outstanding vendor payables.
          </div>
        ) : (
          payables.map((vendor) => (
            <div key={vendor.vendorId} className="rounded-lg border bg-card overflow-hidden">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b px-5 py-3.5 bg-muted/20 gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    <Link href={`/vendors/${vendor.vendorId}`} className="hover:underline text-primary">
                      {vendor.vendorName}
                    </Link>
                  </h3>
                  <p className="text-[10px] text-muted-foreground uppercase">Vendor Bill Summary</p>
                </div>
                <div className="flex gap-4 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px] font-sans">Total Owed</span>
                    <span className="font-bold text-foreground">{formatCurrency(vendor.outstandingPaise)}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Expense #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Outstanding Amount</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendor.items.map((item) => (
                    <TableRow key={item.expenseId}>
                      <TableCell className="font-semibold text-xs text-primary hover:underline">
                        <Link href={`/expenses/${item.expenseId}`}>{item.expenseNumber}</Link>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(item.date)}</TableCell>
                      <TableCell className="text-xs max-w-sm truncate">{item.description}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-foreground">{formatCurrency(item.outstandingPaise)}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
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
