import { PageHeader } from "@/components/shared/page-header";
import { getBalanceSheet } from "@/lib/services/accounting/reports";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Scale, ShieldAlert } from "lucide-react";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";

export const metadata = { title: "Balance Sheet — Priinteve Business OS" };
export const dynamic = "force-dynamic";

interface SearchParams {
  asOf?: string;
}

export default async function BalanceSheetPage(props: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission("reports:view");
  } catch {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const asOfStr = searchParams.asOf || new Date().toISOString().slice(0, 10);
  const asOf = new Date(asOfStr + "T23:59:59");

  const report = await getBalanceSheet(asOf);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <PageHeader
          title="Balance Sheet"
          description="Statement of financial position: Assets, Liabilities and Equity."
        />
        <ReportExportButtons reportName="Balance_Sheet" />
      </div>

      {/* Date Filter Form */}
      <form method="get" className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-card print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">As Of Date</label>
          <input
            type="date"
            name="asOf"
            defaultValue={asOfStr}
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

      {/* Imbalance Warning Indicator */}
      {!report.isBalanced && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-400 no-print">
          <AlertCircle className="size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold">Accounting Discrepancy Alert: Balance Sheet Unbalanced!</h4>
            <p>
              The double-entry equation is not satisfied: <strong>Assets = Liabilities + Equity</strong>
            </p>
            <p className="font-mono">
              Difference (Assets - Liabilities/Equity): {formatCurrency(report.imbalancePaise)}
            </p>
            <p className="text-[10px] text-muted-foreground font-sans">
              Verify opening balances, manual journal adjustments, and unposted draft transaction activities.
            </p>
          </div>
        </div>
      )}

      {/* Report Document */}
      <div id="report-container" className="rounded-lg border bg-card p-8 space-y-6 bg-white dark:bg-zinc-950 font-sans">
        {/* Header */}
        <div className="text-center border-b pb-6 space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Priinteve Business OS</h2>
          <h3 className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
            Balance Sheet
          </h3>
          <p className="text-xs text-muted-foreground">As Of: {formatDate(asOf)}</p>
        </div>

        {/* Sections layout: Left side Assets, Right side Liabilities + Equity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
          {/* ASSETS SECTION */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground uppercase border-b pb-1">ASSETS</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-xs text-muted-foreground italic">
                      No asset accounts.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.assets.map((a) => (
                    <TableRow key={a.accountId}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{a.accountCode}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/accounting/ledger?accountId=${a.accountId}`} className="hover:underline text-primary">
                          {a.accountName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(a.balancePaise)}</TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-muted/10 font-bold border-t-2">
                  <TableCell colSpan={2} className="text-xs uppercase">Total Assets</TableCell>
                  <TableCell className="text-right text-xs font-mono">{formatCurrency(report.totalAssets)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* LIABILITIES + EQUITY SECTION */}
          <div className="space-y-6">
            {/* Liabilities */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-foreground uppercase border-b pb-1">LIABILITIES</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.liabilities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-xs text-muted-foreground italic">
                        No liability accounts.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.liabilities.map((l) => (
                      <TableRow key={l.accountId}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{l.accountCode}</TableCell>
                        <TableCell className="font-medium text-foreground">
                          <Link href={`/accounting/ledger?accountId=${l.accountId}`} className="hover:underline text-primary">
                            {l.accountName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(l.balancePaise)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-muted/10 font-bold border-t-2">
                    <TableCell colSpan={2} className="text-xs uppercase">Total Liabilities</TableCell>
                    <TableCell className="text-right text-xs font-mono">{formatCurrency(report.totalLiabilities)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Equity */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-foreground uppercase border-b pb-1">EQUITY</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.equity.map((e) => (
                    <TableRow key={e.accountId}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{e.accountCode}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/accounting/ledger?accountId=${e.accountId}`} className="hover:underline text-primary">
                          {e.accountName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(e.balancePaise)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Retained Earnings (Profit injected dynamically) */}
                  <TableRow>
                    <TableCell className="font-mono text-xs text-muted-foreground">3020</TableCell>
                    <TableCell className="font-medium text-foreground">
                      Retained Earnings / Current Period Net Earnings
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(report.retainedEarnings)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/10 font-bold border-t-2">
                    <TableCell colSpan={2} className="text-xs uppercase">Total Equity</TableCell>
                    <TableCell className="text-right text-xs font-mono">{formatCurrency(report.totalEquity)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Double-Entry Check Footer */}
        <div className="border-t-4 pt-4 flex flex-col md:flex-row md:items-center justify-between text-xs font-mono">
          <div className="flex gap-4">
            <div>
              <span className="text-muted-foreground block text-[10px] font-sans uppercase">Total Assets</span>
              <span className="text-base font-bold text-foreground">{formatCurrency(report.totalAssets)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] font-sans uppercase">Liabilities + Equity</span>
              <span className="text-base font-bold text-foreground">{formatCurrency(report.totalLiabilities + report.totalEquity)}</span>
            </div>
          </div>
          <div className="mt-2 md:mt-0">
            {report.isBalanced ? (
              <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold px-3 py-1 border rounded border-emerald-300">
                <Scale className="size-4 text-emerald-600" />
                Ledger Balanced: A = L + E
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 bg-red-50 text-red-700 font-semibold px-3 py-1 border rounded border-red-300">
                <ShieldAlert className="size-4 text-red-600" />
                Ledger Out of Balance
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
