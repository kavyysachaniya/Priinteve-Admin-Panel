import { PageHeader } from "@/components/shared/page-header";
import { getJournalEntryDetail } from "@/lib/services/accounting/journal";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { JournalReversalButton } from "@/components/accounting/journal-reversal-button";

export const metadata = { title: "Journal Entry Detail — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function JournalDetailPage(props: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("journal:view");
  } catch {
    redirect("/accounting/journal");
  }

  const { id } = await props.params;
  const entry = await getJournalEntryDetail(id);
  if (!entry) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={`Journal Entry: ${entry.number}`}
        description={`Created from ${entry.sourceType || "manual"} source.`}
        backHref="/accounting/journal"
        actions={
          entry.status === "POSTED" && !entry.reversalFor ? (
            <JournalReversalButton journalId={entry.id} journalNumber={entry.number} />
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="md:col-span-1 rounded-lg border bg-card p-5 space-y-4 text-xs">
          <h3 className="text-sm font-semibold border-b pb-2">Entry Information</h3>
          <div className="space-y-2">
            <div>
              <span className="text-muted-foreground block">Journal Number</span>
              <span className="font-semibold text-foreground">{entry.number}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Date</span>
              <span className="font-semibold text-foreground">{formatDate(entry.date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Source Type</span>
              <span className="font-semibold text-foreground capitalize">{entry.sourceType || "manual"}</span>
            </div>
            {entry.reference && (
              <div>
                <span className="text-muted-foreground block">Reference</span>
                <span className="font-mono font-semibold text-foreground">{entry.reference}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground block">Status</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-[10px] mt-0.5 ${
                entry.status === "POSTED"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                  : entry.status === "DRAFT"
                  ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                  : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
              }`}>
                {entry.status}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Created By</span>
              <span className="font-semibold text-foreground">{entry.createdBy?.name || "System"}</span>
            </div>

            {/* Reversal References */}
            {entry.reversalFor && (
              <div className="rounded p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-amber-800 dark:text-amber-400">
                <span className="block font-bold">This is a Reversal Entry</span>
                Reverses original journal{" "}
                <Link href={`/accounting/journal/${entry.reversalFor.id}`} className="underline font-semibold font-mono">
                  {entry.reversalFor.number}
                </Link>
              </div>
            )}
            {entry.reversedBy && (
              <div className="rounded p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-800 dark:text-red-400">
                <span className="block font-bold">This Entry was Reversed</span>
                Corrected in journal{" "}
                <Link href={`/accounting/journal/${entry.reversedBy.id}`} className="underline font-semibold font-mono">
                  {entry.reversedBy.number}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Lines Card */}
        <div className="md:col-span-2 rounded-lg border bg-card p-5 space-y-4">
          <div className="border-b pb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Journal Lines</h3>
            <span className="text-xs text-muted-foreground font-mono">
              Total: {formatCurrency(entry.totalDebit)}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((line) => {
                const account = line.debitPaise > 0 ? line.debitAccount : line.creditAccount;
                return (
                  <TableRow key={line.id}>
                    <TableCell className="text-xs">
                      {account ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{account.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{account.code}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {line.debitPaise > 0 ? formatCurrency(line.debitPaise) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {line.creditPaise > 0 ? formatCurrency(line.creditPaise) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {line.description || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
