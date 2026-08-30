import { PageHeader } from "@/components/shared/page-header";
import { getAccountLedger, getJournalEntryDetail } from "@/lib/services/accounting/journal";
import { listAccounts } from "@/lib/services/accounting/accounts";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "General Ledger — Priinteve Business OS" };
export const dynamic = "force-dynamic";

interface SearchParams {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
}

export default async function LedgerPage(props: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission("journal:view");
  } catch {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const accounts = await listAccounts({ activeOnly: true });

  // Default to the first account (usually Cash or Bank) if not specified
  const selectedAccountId = searchParams.accountId || (accounts.length > 0 ? accounts[0].id : "");
  const startDate = searchParams.startDate || "";
  const endDate = searchParams.endDate || "";
  const page = Number(searchParams.page || "1");

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  let ledgerData = {
    lines: [] as any[],
    openingBalance: 0,
    closingBalance: 0,
    total: 0,
  };

  if (selectedAccountId) {
    ledgerData = await getAccountLedger(selectedAccountId, {
      startDate,
      endDate,
      page,
    });
  }

  const isDebitNormal = selectedAccount
    ? selectedAccount.type === "ASSET" || selectedAccount.type === "EXPENSE"
    : true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Ledger"
        description="Trace financial line-item movements for individual accounts."
      />

      {/* Filter Bar */}
      <form method="get" className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-card">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Account</label>
          <select
            name="accountId"
            defaultValue={selectedAccountId}
            className="text-xs border rounded px-3 py-1.5 bg-background font-medium"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name} ({acc.type})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">From Date</label>
          <input
            type="date"
            name="startDate"
            defaultValue={startDate}
            className="text-xs border rounded px-3 py-1.5 bg-background"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">To Date</label>
          <input
            type="date"
            name="endDate"
            defaultValue={endDate}
            className="text-xs border rounded px-3 py-1.5 bg-background"
          />
        </div>

        <div className="flex items-end h-full pt-4">
          <button
            type="submit"
            className="text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/95 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Ledger Table */}
      {selectedAccount ? (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/20">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Account Ledger: {selectedAccount.code} — {selectedAccount.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Normal balance: {isDebitNormal ? "Debit" : "Credit"}
              </p>
            </div>
            <div className="flex gap-6 text-xs text-right">
              <div>
                <span className="text-muted-foreground block">Opening Balance</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(ledgerData.openingBalance)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Closing Balance</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(ledgerData.closingBalance)}
                </span>
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[120px]">Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right font-semibold">Running Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Opening Balance Line */}
              <TableRow className="bg-muted/10 font-medium">
                <TableCell colSpan={3} className="text-xs italic text-muted-foreground">
                  Opening Balance
                </TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right text-xs">
                  {formatCurrency(ledgerData.openingBalance)}
                </TableCell>
              </TableRow>

              {ledgerData.lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground italic">
                    No ledger transactions found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                ledgerData.lines.map((line, idx) => (
                  <TableRow key={`${line.journalEntryId}-${idx}`}>
                    <TableCell className="text-xs">{formatDate(line.date)}</TableCell>
                    <TableCell className="font-semibold text-xs text-primary hover:underline">
                      {line.sourceLink ? (
                        <Link href={line.sourceLink}>{line.journalNumber}</Link>
                      ) : (
                        <Link href={`/accounting/journal/${line.journalEntryId}`}>{line.journalNumber}</Link>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium max-w-sm truncate">
                      {line.description}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {line.debitPaise > 0 ? formatCurrency(line.debitPaise) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {line.creditPaise > 0 ? formatCurrency(line.creditPaise) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-foreground">
                      {formatCurrency(line.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Simple Pagination */}
          {ledgerData.total > 20 && (
            <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/10">
              <span className="text-xs text-muted-foreground">
                Showing {Math.min(ledgerData.total, (page - 1) * 20 + 1)} -{" "}
                {Math.min(ledgerData.total, page * 20)} of {ledgerData.total} entries
              </span>
              <div className="flex gap-2">
                <Link
                  href={{
                    query: { ...searchParams, page: String(Math.max(1, page - 1)) },
                  }}
                  className={`text-xs font-semibold px-3 py-1 border rounded bg-background hover:bg-muted ${
                    page <= 1 ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  Previous
                </Link>
                <Link
                  href={{
                    query: { ...searchParams, page: String(page + 1) },
                  }}
                  className={`text-xs font-semibold px-3 py-1 border rounded bg-background hover:bg-muted ${
                    page * 20 >= ledgerData.total ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  Next
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground italic">
          Please select or configure accounts.
        </div>
      )}
    </div>
  );
}
