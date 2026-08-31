import { PageHeader } from "@/components/shared/page-header";
import { getGSTReport, resolveDateRange, type DateRangePreset } from "@/lib/services/accounting/reports";
import { getCompanySettings } from "@/lib/services/settings";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AlertCircle, Scale, ShieldAlert } from "lucide-react";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";

export const metadata = { title: "GST & Tax Summary — Priinteve Business OS" };
export const dynamic = "force-dynamic";

interface SearchParams {
  preset?: DateRangePreset;
  start?: string;
  end?: string;
}

export default async function TaxPage(props: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission("tax:view");
  } catch {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const preset = searchParams.preset || "this_month";
  const start = searchParams.start || "";
  const end = searchParams.end || "";

  const dateRange = resolveDateRange(preset, { start, end });
  const [report, settings] = await Promise.all([
    getGSTReport(dateRange),
    getCompanySettings(),
  ]);

  const companyState = (settings.state || "Gujarat").trim().toLowerCase();

  // Helper function to categorise GST entry into CGST/SGST vs IGST
  const getGSTBreakdown = (gstPaise: number, invoiceOrExpenseState?: string) => {
    const itemState = (invoiceOrExpenseState || companyState).trim().toLowerCase();
    const isIntrastate = itemState === companyState;

    if (isIntrastate) {
      // Split into CGST (50%) and SGST (50%)
      const cgst = Math.round(gstPaise / 2);
      const sgst = gstPaise - cgst; // to avoid rounding discrepancy
      return { cgst, sgst, igst: 0, isIntrastate: true };
    } else {
      return { cgst: 0, sgst: 0, igst: gstPaise, isIntrastate: false };
    }
  };

  // Compile detailed breakdowns
  let totalCGSTOutput = 0;
  let totalSGSTOutput = 0;
  let totalIGSTOutput = 0;
  let totalCGSTInput = 0;
  let totalSGSTInput = 0;
  let totalIGSTInput = 0;

  // Let's resolve the state for each transaction by querying database details
  // For output entries (invoices): fetch customer state
  const invoiceJournalEntryIds = report.outputEntries.map((e) => e.journalEntryId);
  const expenseJournalEntryIdsForFetch = report.inputEntries.map((e) => e.journalEntryId);

  const [invoicesWithCustomers, expensesWithVendors] = await Promise.all([
    prisma.invoice.findMany({
      where: { journalEntries: { some: { id: { in: invoiceJournalEntryIds } } } },
      include: {
        customer: { select: { state: true } },
        journalEntries: { where: { id: { in: invoiceJournalEntryIds } }, select: { id: true } },
      },
    }),
    prisma.expense.findMany({
      where: { journalEntries: { some: { id: { in: expenseJournalEntryIdsForFetch } } } },
      include: {
        vendor: { select: { state: true } },
        journalEntries: { where: { id: { in: expenseJournalEntryIdsForFetch } }, select: { id: true } },
      },
    }),
  ]);

  // Keyed by journalEntryId (not invoice id) since that's what we look up by below —
  // an invoice can back multiple journal entries (e.g. original + a reversal).
  const invoiceStateMap = new Map<string, string>();
  for (const inv of invoicesWithCustomers) {
    for (const je of inv.journalEntries) {
      invoiceStateMap.set(je.id, inv.customer.state ?? "");
    }
  }

  const outputDetailed = report.outputEntries.map((entry) => {
    const state = entry.sourceType === "invoice" ? invoiceStateMap.get(entry.journalEntryId) : undefined;
    const breakdown = getGSTBreakdown(entry.gstPaise, state);

    totalCGSTOutput += breakdown.cgst;
    totalSGSTOutput += breakdown.sgst;
    totalIGSTOutput += breakdown.igst;

    return { ...entry, ...breakdown };
  });

  // Keyed by journalEntryId (not expense id) — same reasoning as invoiceStateMap above.
  const expenseStateMap = new Map<string, string>();
  for (const exp of expensesWithVendors) {
    for (const je of exp.journalEntries) {
      expenseStateMap.set(je.id, exp.vendor?.state || "");
    }
  }

  const inputDetailed = report.inputEntries.map((entry) => {
    const state = entry.sourceType === "expense" ? expenseStateMap.get(entry.journalEntryId) : undefined;
    const breakdown = getGSTBreakdown(entry.gstPaise, state);

    totalCGSTInput += breakdown.cgst;
    totalSGSTInput += breakdown.sgst;
    totalIGSTInput += breakdown.igst;

    return { ...entry, ...breakdown };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <PageHeader
          title="GST & Tax Summary"
          description="Internal management tool for tracking Input Tax Credit (ITC) and Output GST."
        />
        <ReportExportButtons reportName="GST_Summary_Report" />
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
            Generate Summary
          </button>
        </div>
      </form>

      {/* Disclaimer Box */}
      <div className="flex items-start gap-2.5 p-3.5 rounded border border-warning/30 bg-warning/10 text-warning-foreground text-xs no-print dark:text-warning">
        <AlertCircle className="size-5 shrink-0 text-warning" />
        <div>
          <span className="font-bold">Disclaimer: Management Reporting Tool Only.</span> This module computes tax values based purely on internal invoice and expense records for managerial reconciliation and cash planning. It does not constitute a legally compliant GST return filing form. Consult your chartered accountant for tax filings.
        </div>
      </div>

      {/* Report Document */}
      <div id="report-container" className="rounded-lg border bg-card p-8 space-y-8 bg-white dark:bg-zinc-950 font-sans">
        {/* Header */}
        <div className="text-center border-b pb-6 space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Priinteve Business OS</h2>
          <h3 className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
            GST & Tax Summary
          </h3>
          <p className="text-xs text-muted-foreground">
            Period: {formatDate(report.startDate)} to {formatDate(report.endDate)}
          </p>
        </div>

        {/* GST Overview Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 font-mono text-center text-xs">
          <div className="border rounded p-4">
            <span className="text-[10px] font-sans text-muted-foreground block uppercase">Total Output GST (Liability)</span>
            <span className="text-base font-bold text-foreground">{formatCurrency(report.outputGstPaise)}</span>
            <div className="mt-2 text-[10px] text-muted-foreground font-sans text-left border-t pt-1.5 space-y-0.5">
              <div className="flex justify-between"><span>CGST (Intra)</span><span>{formatCurrency(totalCGSTOutput)}</span></div>
              <div className="flex justify-between"><span>SGST (Intra)</span><span>{formatCurrency(totalSGSTOutput)}</span></div>
              <div className="flex justify-between"><span>IGST (Inter)</span><span>{formatCurrency(totalIGSTOutput)}</span></div>
            </div>
          </div>
          <div className="border rounded p-4">
            <span className="text-[10px] font-sans text-muted-foreground block uppercase">Total Input GST (Credit)</span>
            <span className="text-base font-bold text-foreground">{formatCurrency(report.inputGstPaise)}</span>
            <div className="mt-2 text-[10px] text-muted-foreground font-sans text-left border-t pt-1.5 space-y-0.5">
              <div className="flex justify-between"><span>CGST (Intra)</span><span>{formatCurrency(totalCGSTInput)}</span></div>
              <div className="flex justify-between"><span>SGST (Intra)</span><span>{formatCurrency(totalSGSTInput)}</span></div>
              <div className="flex justify-between"><span>IGST (Inter)</span><span>{formatCurrency(totalIGSTInput)}</span></div>
            </div>
          </div>
          <div className={`border rounded p-4 ${report.netGstPayablePaise >= 0 ? "bg-destructive/10 border-destructive/30" : "bg-success/10 border-success/30"}`}>
            <span className="text-[10px] font-sans text-muted-foreground block uppercase">Net GST Position</span>
            <span className={`text-base font-bold ${report.netGstPayablePaise >= 0 ? "text-destructive" : "text-success"}`}>
              {formatCurrency(Math.abs(report.netGstPayablePaise))}
            </span>
            <span className="block text-[10px] text-muted-foreground font-sans mt-0.5">
              {report.netGstPayablePaise >= 0 ? "Net Tax Payable" : "Input Credit Carry Forward"}
            </span>
            <div className="mt-2 text-[10px] text-muted-foreground font-sans text-left border-t pt-1.5 space-y-0.5">
              <div className="flex justify-between"><span>Net CGST</span><span>{formatCurrency(Math.abs(totalCGSTOutput - totalCGSTInput))}</span></div>
              <div className="flex justify-between"><span>Net SGST</span><span>{formatCurrency(Math.abs(totalSGSTOutput - totalSGSTInput))}</span></div>
              <div className="flex justify-between"><span>Net IGST</span><span>{formatCurrency(Math.abs(totalIGSTOutput - totalIGSTInput))}</span></div>
            </div>
          </div>
        </div>

        {/* Output GST Drilldown Invoices */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase border-b pb-1">
            Output GST Ledger (Sales Invoices contributing)
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[120px]">Reference</TableHead>
                <TableHead>Customer / Description</TableHead>
                <TableHead className="text-right">CGST (₹)</TableHead>
                <TableHead className="text-right">SGST (₹)</TableHead>
                <TableHead className="text-right">IGST (₹)</TableHead>
                <TableHead className="text-right font-bold">Total GST</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outputDetailed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-xs italic text-muted-foreground">
                    No output tax transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                outputDetailed.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs">{formatDate(entry.date)}</TableCell>
                    <TableCell className="font-semibold text-xs text-primary hover:underline">
                      <Link href={`/accounting/journal/${entry.journalEntryId}`}>{entry.reference || "JE"}</Link>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">{entry.cgst > 0 ? formatCurrency(entry.cgst) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{entry.sgst > 0 ? formatCurrency(entry.sgst) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{entry.igst > 0 ? formatCurrency(entry.igst) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-foreground">
                      {formatCurrency(entry.gstPaise)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Input GST Drilldown Expenses */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase border-b pb-1">
            Input GST Ledger (Vendor Purchases contributing)
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[120px]">Reference</TableHead>
                <TableHead>Vendor / Description</TableHead>
                <TableHead className="text-right">CGST (₹)</TableHead>
                <TableHead className="text-right">SGST (₹)</TableHead>
                <TableHead className="text-right">IGST (₹)</TableHead>
                <TableHead className="text-right font-bold">Total ITC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inputDetailed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-xs italic text-muted-foreground">
                    No input tax transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                inputDetailed.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs">{formatDate(entry.date)}</TableCell>
                    <TableCell className="font-semibold text-xs text-primary hover:underline">
                      <Link href={`/accounting/journal/${entry.journalEntryId}`}>{entry.reference || "JE"}</Link>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">{entry.cgst > 0 ? formatCurrency(entry.cgst) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{entry.sgst > 0 ? formatCurrency(entry.sgst) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{entry.igst > 0 ? formatCurrency(entry.igst) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-foreground">
                      {formatCurrency(entry.gstPaise)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
