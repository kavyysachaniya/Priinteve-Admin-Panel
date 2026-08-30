import { PageHeader } from "@/components/shared/page-header";
import { getProfitAndLoss, resolveDateRange, type DateRangePreset } from "@/lib/services/accounting/reports";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, IndianRupee } from "lucide-react";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";

export const metadata = { title: "Profit & Loss Statement — Priinteve Business OS" };
export const dynamic = "force-dynamic";

interface SearchParams {
  preset?: DateRangePreset;
  start?: string;
  end?: string;
}

export default async function ProfitAndLossPage(props: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission("reports:view");
  } catch {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const preset = searchParams.preset || "this_month";
  const start = searchParams.start || "";
  const end = searchParams.end || "";

  const dateRange = resolveDateRange(preset, { start, end });
  const report = await getProfitAndLoss(dateRange);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <PageHeader
          title="Profit & Loss Statement"
          description="Accrual-based income and expense performance breakdown."
        />
        <ReportExportButtons reportName="Profit_Loss_Statement" />
      </div>

      {/* Date Filters Form */}
      <form method="get" className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-card print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Range Preset</label>
          <select
            name="preset"
            defaultValue={preset}
            className="text-xs border rounded px-3 py-1.5 bg-background font-medium"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Start Date</label>
          <input
            type="date"
            name="start"
            defaultValue={start}
            className="text-xs border rounded px-3 py-1.5 bg-background"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">End Date</label>
          <input
            type="date"
            name="end"
            defaultValue={end}
            className="text-xs border rounded px-3 py-1.5 bg-background"
          />
        </div>

        <div className="flex items-end h-full pt-4">
          <button
            type="submit"
            className="text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/95 transition-colors"
          >
            Generate Report
          </button>
        </div>
      </form>

      {/* Report Document */}
      <div id="report-container" className="rounded-lg border bg-card p-8 space-y-6 bg-white dark:bg-zinc-950 font-sans">
        {/* Header */}
        <div className="text-center border-b pb-6 space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Priinteve Business OS</h2>
          <h3 className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
            Profit & Loss Statement
          </h3>
          <p className="text-xs text-muted-foreground">
            Period: {formatDate(report.startDate)} to {formatDate(report.endDate)}
          </p>
        </div>

        {/* Top Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-center">
          <div className="border rounded p-4">
            <span className="text-[10px] font-sans text-muted-foreground block uppercase">Total Revenue</span>
            <span className="text-lg font-bold text-foreground">{formatCurrency(report.totalIncomePaise)}</span>
          </div>
          <div className="border rounded p-4">
            <span className="text-[10px] font-sans text-muted-foreground block uppercase">Total Expenses</span>
            <span className="text-lg font-bold text-foreground">{formatCurrency(report.totalExpensesPaise)}</span>
          </div>
          <div className="border rounded p-4 bg-primary/5 border-primary/20">
            <span className="text-[10px] font-sans text-primary/80 block uppercase">Net Profit / Loss</span>
            <span className={`text-lg font-bold ${report.netProfitPaise >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {formatCurrency(report.netProfitPaise)}
            </span>
          </div>
        </div>

        {/* Breakdown sections */}
        <div className="space-y-6">
          {/* INCOME SECTION */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase border-b pb-1">INCOME</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Account Code</TableHead>
                  <TableHead>Account Description</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.incomeByAccount.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-xs italic text-muted-foreground">
                      No income recorded for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.incomeByAccount.map((inc) => (
                    <TableRow key={inc.accountId}>
                      <TableCell className="font-mono text-xs">{inc.accountCode}</TableCell>
                      <TableCell className="text-xs">
                        <Link href={`/accounting/ledger?accountId=${inc.accountId}`} className="hover:underline text-primary">
                          {inc.accountName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">{formatCurrency(inc.amountPaise)}</TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-muted/10 font-bold">
                  <TableCell colSpan={2} className="text-xs uppercase">Total Operating Income</TableCell>
                  <TableCell className="text-right text-xs font-mono">{formatCurrency(report.totalIncomePaise)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* EXPENSES SECTION */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase border-b pb-1">EXPENSES</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Account Code</TableHead>
                  <TableHead>Account Description</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.expensesByAccount.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-xs italic text-muted-foreground">
                      No expenses recorded for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.expensesByAccount.map((exp) => (
                    <TableRow key={exp.accountId}>
                      <TableCell className="font-mono text-xs">{exp.accountCode}</TableCell>
                      <TableCell className="text-xs">
                        <Link href={`/accounting/ledger?accountId=${exp.accountId}`} className="hover:underline text-primary">
                          {exp.accountName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">{formatCurrency(exp.amountPaise)}</TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-muted/10 font-bold">
                  <TableCell colSpan={2} className="text-xs uppercase">Total Operating Expenses</TableCell>
                  <TableCell className="text-right text-xs font-mono">{formatCurrency(report.totalExpensesPaise)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* NET SUMMARY */}
          <div className="flex justify-between items-center bg-muted/20 border rounded-lg p-5">
            <span className="text-sm font-bold text-foreground uppercase">Net Earnings (Profit / Loss)</span>
            <span className={`text-lg font-mono font-bold ${report.netProfitPaise >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {formatCurrency(report.netProfitPaise)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
