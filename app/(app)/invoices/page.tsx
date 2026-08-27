export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listInvoices } from "@/lib/services/invoices";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";
import type { InvoiceStatus } from "@prisma/client";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? (sp.status as InvoiceStatus) : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;

  const { invoices, total, pageSize } = await listInvoices({ q, status, page });
  const isFiltered = Boolean(q || status);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Bills issued to customers and their payment status."
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="size-4" /> New Invoice
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
                { value: "PARTIALLY_PAID", label: "Partially Paid" },
                { value: "PAID", label: "Paid" },
                { value: "OVERDUE", label: "Overdue" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </TableToolbar>
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={isFiltered ? "No invoices match your filters" : "No invoices yet"}
            description={
              isFiltered
                ? "Try a different search term or clear filters."
                : "Create an invoice manually or convert an accepted quotation."
            }
            action={
              !isFiltered && (
                <Button asChild size="sm">
                  <Link href="/invoices/new">
                    <Plus className="size-4" /> New Invoice
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/customers/${inv.customer.id}`} className="hover:underline">
                        {inv.customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(inv.totalPaise)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {inv.totalPaise - inv.amountPaidPaise > 0 ? (
                        <span className="font-medium text-destructive">
                          {formatCurrency(inv.totalPaise - inv.amountPaidPaise)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">₹0.00</span>
                      )}
                    </TableCell>
                    <TableCell><InvoiceStatusBadge status={inv.effectiveStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <TablePagination page={page} pageSize={pageSize} total={total} />
      </div>
    </div>
  );
}
