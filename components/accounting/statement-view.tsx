"use client";

import { useState, useRef } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fetchCustomerStatementAction, fetchVendorStatementAction } from "@/lib/actions/statements";
import { exportElementToPdf } from "@/lib/pdf/exporter";

interface StatementLine {
  date: string | Date;
  reference: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  balance: number;
}

interface StatementData {
  customerName?: string;
  vendorName?: string;
  lines: StatementLine[];
  openingBalance: number;
  closingBalance: number;
}

interface StatementViewProps {
  entityId: string;
  entityType: "customer" | "vendor";
  initialStatement: StatementData;
  companySettings: any;
}

export function StatementView({
  entityId,
  entityType,
  initialStatement,
  companySettings,
}: StatementViewProps) {
  const [statement, setStatement] = useState<StatementData>(initialStatement);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const name = statement.customerName || statement.vendorName || "Business Partner";

  const handleFilter = async () => {
    setLoading(true);
    try {
      let data;
      if (entityType === "customer") {
        data = await fetchCustomerStatementAction(entityId, startDate, endDate);
      } else {
        data = await fetchVendorStatementAction(entityId, startDate, endDate);
      }

      if (data) {
        setStatement(data as any);
        toast.success("Statement updated");
      } else {
        toast.error("Failed to load statement data");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update statement");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePdfDownload = async () => {
    if (!printRef.current) return;
    setLoading(true);
    try {
      const title = `${name.replace(/\s+/g, "_")}_Statement`;
      await exportElementToPdf(printRef.current, title);
      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setLoading(false);
    }
  };

  // Aggregates
  const totalDebit = statement.lines.reduce((sum, line) => sum + line.debitPaise, 0);
  const totalCredit = statement.lines.reduce((sum, line) => sum + line.creditPaise, 0);

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-card no-print">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs border rounded px-3 py-1.5 bg-background"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs border rounded px-3 py-1.5 bg-background"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button size="sm" onClick={handleFilter} disabled={loading}>
            <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Apply Filter
          </Button>

          <Button size="sm" variant="outline" onClick={handlePrint} disabled={loading}>
            <Printer className="size-3.5 mr-1" />
            Print
          </Button>

          <Button size="sm" variant="outline" onClick={handlePdfDownload} disabled={loading}>
            <Download className="size-3.5 mr-1" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Printable Area */}
      <div ref={printRef} className="rounded-lg border bg-card p-8 space-y-6 bg-white dark:bg-zinc-950">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b pb-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight text-primary">
              {companySettings.name || "Priinteve"}
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm">
              {[companySettings.addressLine1, companySettings.addressLine2, companySettings.city, companySettings.state, companySettings.pincode]
                .filter(Boolean)
                .join(", ")}
            </p>
            <div className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
              {companySettings.gstin && <div>GSTIN: {companySettings.gstin}</div>}
              {companySettings.phone && <div>Phone: {companySettings.phone}</div>}
              {companySettings.email && <div>Email: {companySettings.email}</div>}
            </div>
          </div>
          <div className="text-right space-y-1">
            <h3 className="text-lg font-bold uppercase tracking-wider text-muted-foreground">
              Statement of Account
            </h3>
            <p className="text-xs font-mono font-medium">
              Generated: {format(new Date(), "d MMM yyyy")}
            </p>
            {(startDate || endDate) && (
              <p className="text-xs text-muted-foreground">
                Period: {startDate ? formatDate(new Date(startDate)) : "Start"} to{" "}
                {endDate ? formatDate(new Date(endDate)) : "End"}
              </p>
            )}
          </div>
        </div>

        {/* Statement To & Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
              Statement To:
            </h4>
            <p className="font-bold text-foreground text-sm">{name}</p>
            <p className="text-muted-foreground mt-0.5">
              {entityType === "customer" ? "Valued Client" : "Valued Vendor"}
            </p>
          </div>

          <div className="md:text-right space-y-1 bg-muted/20 p-4 rounded-md border">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Statement Summary
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono mt-1 text-xs">
              <span className="text-left text-muted-foreground">Opening Balance</span>
              <span className="text-right font-medium">{formatCurrency(statement.openingBalance)}</span>

              <span className="text-left text-muted-foreground">
                {entityType === "customer" ? "Total Invoiced (+)" : "Total Bills (+)"}
              </span>
              <span className="text-right font-medium">{formatCurrency(totalDebit)}</span>

              <span className="text-left text-muted-foreground">Total Payments (-)</span>
              <span className="text-right font-medium">{formatCurrency(totalCredit)}</span>

              <span className="text-left font-bold text-foreground border-t pt-1">Closing Balance</span>
              <span className="text-right font-bold text-foreground border-t pt-1">
                {formatCurrency(statement.closingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="p-3 w-[100px]">Date</th>
                <th className="p-3 w-[120px]">Reference</th>
                <th className="p-3">Description</th>
                <th className="p-3 w-[120px] text-right">Debit (₹)</th>
                <th className="p-3 w-[120px] text-right">Credit (₹)</th>
                <th className="p-3 w-[120px] text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Line */}
              <tr className="bg-muted/10 font-medium border-b">
                <td colSpan={3} className="p-3 italic text-muted-foreground">
                  Opening Balance
                </td>
                <td className="p-3 text-right">—</td>
                <td className="p-3 text-right">—</td>
                <td className="p-3 text-right font-mono font-semibold">
                  {formatCurrency(statement.openingBalance)}
                </td>
              </tr>

              {statement.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 italic text-muted-foreground text-xs">
                    No transactions found for this period.
                  </td>
                </tr>
              ) : (
                statement.lines.map((line, idx) => (
                  <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/5 font-mono">
                    <td className="p-3 font-sans text-xs">{formatDate(line.date)}</td>
                    <td className="p-3 font-semibold text-xs">{line.reference}</td>
                    <td className="p-3 font-sans text-xs text-muted-foreground">{line.description}</td>
                    <td className="p-3 text-right text-xs">
                      {line.debitPaise > 0 ? formatCurrency(line.debitPaise) : "—"}
                    </td>
                    <td className="p-3 text-right text-xs">
                      {line.creditPaise > 0 ? formatCurrency(line.creditPaise) : "—"}
                    </td>
                    <td className="p-3 text-right text-xs font-bold text-foreground">
                      {formatCurrency(line.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bank & Payment Details */}
        {companySettings.bankName && (
          <div className="rounded border bg-muted/10 p-4 text-xs space-y-1.5 max-w-md font-sans">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Payment Instruction / Bank Transfer
            </h4>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs font-mono">
              <span className="text-muted-foreground">Bank:</span>
              <span className="font-semibold">{companySettings.bankName}</span>

              <span className="text-muted-foreground">Account Name:</span>
              <span className="font-semibold">{companySettings.bankAccountName}</span>

              <span className="text-muted-foreground">Account Number:</span>
              <span className="font-semibold">{companySettings.bankAccountNumber}</span>

              <span className="text-muted-foreground">IFSC Code:</span>
              <span className="font-semibold">{companySettings.bankIfsc}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
