import { PageHeader } from "@/components/shared/page-header";
import { listJournalEntries } from "@/lib/services/accounting/journal";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Journal Entries — Priinteve Business OS" };
export const dynamic = "force-dynamic";

interface SearchParams {
  page?: string;
  q?: string;
  status?: any;
  startDate?: string;
  endDate?: string;
}

export default async function JournalListPage(props: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission("journal:view");
  } catch {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const page = Number(searchParams.page || "1");
  const q = searchParams.q || "";
  const status = searchParams.status || undefined;
  const startDate = searchParams.startDate || "";
  const endDate = searchParams.endDate || "";

  const { entries, total } = await listJournalEntries({
    page,
    q,
    status,
    startDate,
    endDate,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        description="Double-entry manual adjustments and automated audit logs."
        actions={
          <Button asChild size="sm">
            <Link href="/accounting/journal/new">
              <Plus className="size-4 mr-1" /> Manual Journal
            </Link>
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <form method="get" className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-card">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search JE #, description..."
            className="text-xs border rounded px-3 py-1.5 bg-background w-48"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
          <select
            name="status"
            defaultValue={status || ""}
            className="text-xs border rounded px-3 py-1.5 bg-background font-medium"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="VOID">Void</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">From</label>
          <input
            type="date"
            name="startDate"
            defaultValue={startDate}
            className="text-xs border rounded px-3 py-1.5 bg-background"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">To</label>
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

      {/* Journal Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead className="w-[120px]">Journal #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Total Debit</TableHead>
              <TableHead className="text-right">Total Credit</TableHead>
              <TableHead className="w-[100px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground italic">
                  No journal entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">{formatDate(entry.date)}</TableCell>
                  <TableCell className="font-semibold text-xs text-primary hover:underline">
                    <Link href={`/accounting/journal/${entry.id}`}>{entry.number}</Link>
                  </TableCell>
                  <TableCell className="text-xs font-medium">{entry.description}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground capitalize">
                    {entry.sourceType || "manual"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium text-foreground">
                    {formatCurrency(entry.totalDebit)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium text-foreground">
                    {formatCurrency(entry.totalCredit)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      entry.status === "POSTED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : entry.status === "DRAFT"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {entry.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {total > entries.length && (
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              Showing {Math.min(total, (page - 1) * 20 + 1)} -{" "}
              {Math.min(total, page * 20)} of {total} entries
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
                  page * 20 >= total ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
