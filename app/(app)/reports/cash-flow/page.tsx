import { PageHeader } from "@/components/shared/page-header";
import { getCashFlow, resolveDateRange, type DateRangePreset } from "@/lib/services/accounting/reports";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Landmark, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";

export const metadata = { title: "Cash Flow Statement — Priinteve Business OS" };
export const dynamic = "force-dynamic";

interface SearchParams {
  preset?: DateRangePreset;
  start?: string;
  end?: string;
}

export default async function CashFlowPage(props: { searchParams: Promise<SearchParams> }) {
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
  const report = await getCashFlow(dateRange);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <PageHeader
          title="Cash Flow Statement"
          description="Statement of cash receipts and cash payments."
        />
        <ReportExportButtons reportName="Cash_Flow_Statement" />
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
            Cash Flow Statement
          </h3>
          <p className="text-xs text-muted-foreground">
            Period: {formatDate(report.startDate)} to {formatDate(report.endDate)}
          </p>
        </div>

        {/* Aggregated totals cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 font-mono text-center">
          <div className="border rounded p-4">
            <span className="text-[10px] font-sans text-muted-foreground block uppercase flex items-center justify-center gap-1">
              <Wallet className="size-3 text-muted-foreground" />
              Opening Cash
            </span>
            <span className="text-base font-bold text-foreground">{formatCurrency(report.openingCashPaise)}</span>
          </div>
          <div className="border rounded p-4 text-emerald-600 dark:text-emerald-400">
            <span className="text-[10px] font-sans text-muted-foreground block uppercase flex items-center justify-center gap-1">
              <ArrowUpRight className="size-3 text-emerald-500" />
              Total Inflows
            </span>
            <span className="text-base font-bold">{formatCurrency(report.operatingInflowPaise)}</span>
          </div>
          <div className="border rounded p-4 text-red-500">
            <span className="text-[10px] font-sans text-muted-foreground block uppercase flex items-center justify-center gap-1">
              <ArrowDownRight className="size-3 text-red-500" />
              Total Outflows
            </span>
            <span className="text-base font-bold">{formatCurrency(report.operatingOutflowPaise)}</span>
          </div>
          <div className="border rounded p-4 bg-primary/5 border-primary/20">
            <span className="text-[10px] font-sans text-primary/80 block uppercase flex items-center justify-center gap-1">
              <Landmark className="size-3 text-primary" />
              Closing Cash
            </span>
            <span className="text-base font-bold text-primary">{formatCurrency(report.closingCashPaise)}</span>
          </div>
        </div>

        {/* Details Breakdown Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-sans">
          {/* INFLOWS */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-emerald-700 uppercase border-b pb-1">CASH INFLOWS</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Receipt Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.inflows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-xs italic text-muted-foreground">
                      No cash receipts during this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.inflows.map((inf, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{formatDate(inf.date)}</TableCell>
                      <TableCell className="text-xs font-medium text-foreground">{inf.description}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium text-emerald-600">
                        {formatCurrency(inf.amountPaise)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-emerald-50/50 dark:bg-emerald-950/10 font-bold border-t">
                  <TableCell colSpan={2} className="text-xs uppercase">Total Cash Receipts</TableCell>
                  <TableCell className="text-right text-xs font-mono text-emerald-600">{formatCurrency(report.operatingInflowPaise)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* OUTFLOWS */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-red-700 uppercase border-b pb-1">CASH OUTFLOWS</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Payment Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.outflows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-xs italic text-muted-foreground">
                      No cash payments during this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.outflows.map((out, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{formatDate(out.date)}</TableCell>
                      <TableCell className="text-xs font-medium text-foreground">{out.description}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium text-red-500">
                        {formatCurrency(out.amountPaise)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-red-50/50 dark:bg-red-950/10 font-bold border-t">
                  <TableCell colSpan={2} className="text-xs uppercase">Total Cash Payments</TableCell>
                  <TableCell className="text-right text-xs font-mono text-red-500">{formatCurrency(report.operatingOutflowPaise)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Reconciliation Footer */}
        <div className="border-t-4 pt-4 text-xs font-mono text-muted-foreground flex justify-between items-center">
          <span>Net increase/decrease in cash during period: {formatCurrency(report.netOperatingPaise)}</span>
          <span className="font-bold text-foreground">Reconciled with Cash & Bank Accounts.</span>
        </div>
      </div>
    </div>
  );
}
