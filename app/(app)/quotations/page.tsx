export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus, FileText, Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { QuotationStatusBadge } from "@/components/shared/status-badge";
import { QuickAction, RowActions, RowActionsBar } from "@/components/shared/row-actions";
import { QuotationRowActions } from "@/components/quotations/quotation-row-actions";
import { DeleteQuotationItem } from "@/components/quotations/delete-quotation-item";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { listQuotations } from "@/lib/services/quotations";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";
import type { QuotationStatus } from "@prisma/client";

export const metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: PageProps<"/quotations">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? (sp.status as QuotationStatus) : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;

  const { quotations, total, pageSize } = await listQuotations({ q, status, page });
  const isFiltered = Boolean(q || status);

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Estimates you've shared with customers."
        actions={
          <Button asChild>
            <Link href="/quotations/new">
              <Plus className="size-4" /> New Quotation
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <TableToolbar placeholder="Search by number or customer…">
            <TableFilterSelect
              paramName="status"
              placeholder="All statuses"
              options={[
                { value: "DRAFT", label: "Draft" },
                { value: "SENT", label: "Sent" },
                { value: "ACCEPTED", label: "Accepted" },
                { value: "REJECTED", label: "Rejected" },
                { value: "EXPIRED", label: "Expired" },
                { value: "CONVERTED", label: "Converted" },
              ]}
            />
          </TableToolbar>
        </div>

        {quotations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={isFiltered ? "No quotations match your filters" : "No quotations yet"}
            description={
              isFiltered
                ? "Try a different search term or clear filters."
                : "Create your first quotation to get started."
            }
            action={
              !isFiltered && (
                <Button asChild size="sm">
                  <Link href="/quotations/new">
                    <Plus className="size-4" /> New Quotation
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Issue Date</TableHead>
                <TableHead className="hidden lg:table-cell">Valid Until</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link href={`/quotations/${q.id}`} className="font-medium text-primary hover:underline">
                      {q.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/customers/${q.customer.id}`} className="hover:underline">
                      {q.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(q.issueDate)}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatDate(q.validUntil)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(q.totalPaise)}</TableCell>
                  <TableCell><QuotationStatusBadge status={q.status} /></TableCell>
                  <TableCell>
                    <RowActionsBar>
                      <QuickAction icon={Eye} label="View" href={`/quotations/${q.id}`} />
                      {q.status !== "CONVERTED" && (
                        <QuickAction icon={Pencil} label="Edit" href={`/quotations/${q.id}/edit`} />
                      )}
                      <RowActions>
                        <QuotationRowActions id={q.id} status={q.status} />
                        {q.status === "DRAFT" && <DropdownMenuSeparator />}
                        <DeleteQuotationItem id={q.id} number={q.number} status={q.status} />
                      </RowActions>
                    </RowActionsBar>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <TablePagination page={page} pageSize={pageSize} total={total} />
      </div>
    </div>
  );
}
