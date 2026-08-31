import Link from "next/link";
import {
  IndianRupee,
  TrendingUp,
  Wallet,
  Receipt,
  Landmark,
  Scale,
  Percent,
  AlertTriangle,
  PenLine,
  BookOpen,
  Calculator,
  CalendarDays,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { listAccounts, getCashBankAccounts } from "@/lib/services/accounting/accounts";
import { getReceivables, getPayables, getGSTReport, getProfitAndLoss, resolveDateRange } from "@/lib/services/accounting/reports";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Finance Overview — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  try {
    await requirePermission("finance:view");
  } catch {
    redirect("/dashboard");
  }

  const now = new Date();
  const currentYearRange = resolveDateRange("this_year");

  // Load all actual accounting-derived numbers
  const [cashBankAccounts, receivables, payables, gstReport, profitLoss] = await Promise.all([
    getCashBankAccounts(),
    getReceivables(),
    getPayables(),
    getGSTReport(currentYearRange),
    getProfitAndLoss(currentYearRange),
  ]);

  const totalCashBankBalance = cashBankAccounts.reduce((sum, a) => sum + a.currentBalancePaise, 0);
  const totalReceivables = receivables.reduce((sum, c) => sum + c.outstandingPaise, 0);
  const totalPayables = payables.reduce((sum, v) => sum + v.outstandingPaise, 0);

  // Quick Insights
  const overdueInvoicesCount = receivables.reduce((sum, c) => sum + c.overdueCount, 0);
  const overdueAmount = receivables.reduce((sum, c) => {
    return sum + c.items.reduce((s, item) => s + (item.daysOverdue > 0 ? item.outstandingPaise : 0), 0);
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Accounting"
        description="Comprehensive accounting overview, liquid cash balances, aging receivables, and tax summaries."
      />

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Revenue (YTD)"
          value={formatCurrency(profitLoss.totalIncomePaise)}
          changeLabel="YTD sales posted revenue"
          changeDirection="neutral"
          icon={IndianRupee}
        />
        <StatCard
          label="Total Expenses (YTD)"
          value={formatCurrency(profitLoss.totalExpensesPaise)}
          changeLabel="YTD operational expenses"
          changeDirection="neutral"
          icon={Receipt}
        />
        <StatCard
          label="Net Profit (YTD)"
          value={formatCurrency(profitLoss.netProfitPaise)}
          changeLabel="Revenue minus expenses"
          changeDirection={profitLoss.netProfitPaise >= 0 ? "up" : "down"}
          icon={TrendingUp}
        />
        <StatCard
          label="Cash & Bank Position"
          value={formatCurrency(totalCashBankBalance)}
          changeLabel="Liquid funds balance"
          changeDirection="neutral"
          icon={Landmark}
        />
      </div>

      {/* Receivables & Payables & GST Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
              <Wallet className="size-3.5 text-muted-foreground" />
              Outstanding Receivables
            </span>
            <Link href="/finance/receivables" className="text-primary hover:underline text-[10px] font-bold">
              View A/R
            </Link>
          </div>
          <p className="text-lg font-bold text-foreground">{formatCurrency(totalReceivables)}</p>
          {overdueInvoicesCount > 0 && (
            <p className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
              <AlertTriangle className="size-3" />
              {formatCurrency(overdueAmount)} is overdue across {overdueInvoicesCount} invoices
            </p>
          )}
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
              <Receipt className="size-3.5 text-muted-foreground" />
              Outstanding Payables
            </span>
            <Link href="/finance/payables" className="text-primary hover:underline text-[10px] font-bold">
              View A/P
            </Link>
          </div>
          <p className="text-lg font-bold text-foreground">{formatCurrency(totalPayables)}</p>
          <p className="text-[10px] text-muted-foreground">
            Owed to {payables.length} active vendors
          </p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
              <Percent className="size-3.5 text-muted-foreground" />
              Net GST Position (YTD)
            </span>
            <Link href="/finance/tax" className="text-primary hover:underline text-[10px] font-bold">
              Tax Summary
            </Link>
          </div>
          <p className={`text-lg font-bold ${gstReport.netGstPayablePaise >= 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
            {formatCurrency(Math.abs(gstReport.netGstPayablePaise))}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {gstReport.netGstPayablePaise >= 0 ? "Net GST liability payable" : "Net input tax credit carry forward"}
          </p>
        </Card>
      </div>

      {/* Cash & Bank balances list and quick ledger references */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cash & Bank Balances */}
        <div className="rounded-lg border bg-card p-5 space-y-4 lg:col-span-2">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-sm font-semibold text-foreground">Cash & Bank Accounts</h3>
            <Link href="/accounts/cash-bank" className="text-xs text-primary hover:underline font-semibold">
              Manage Accounts
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="text-right text-emerald-600">Inflows</TableHead>
                <TableHead className="text-right text-red-500">Outflows</TableHead>
                <TableHead className="text-right font-bold">Current Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashBankAccounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell className="text-xs font-semibold">{acc.name}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatCurrency(acc.openingBalancePaise)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-emerald-600">
                    {acc.totalInflowPaise > 0 ? `+${formatCurrency(acc.totalInflowPaise)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-red-500">
                    {acc.totalOutflowPaise > 0 ? `-${formatCurrency(acc.totalOutflowPaise)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold text-foreground">
                    {formatCurrency(acc.currentBalancePaise)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Quick Insights & Shortcuts */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-sm font-semibold text-foreground">Accounting Adjustments</h3>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
              <Link href="/accounting/journal/new">
                <PenLine className="size-3.5" /> New Manual Journal Entry
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
              <Link href="/accounting/ledger">
                <BookOpen className="size-3.5" /> View General Ledger
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
              <Link href="/accounts">
                <Calculator className="size-3.5" /> View Chart of Accounts
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
              <Link href="/accounting/periods">
                <CalendarDays className="size-3.5" /> View Accounting Periods
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
