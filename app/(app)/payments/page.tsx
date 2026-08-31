export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus, Wallet, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { TablePagination } from "@/components/shared/table-pagination";
import { QuickAction, RowActionsBar } from "@/components/shared/row-actions";
import { PaymentMethodBadge } from "@/components/shared/status-badge";
import { DeletePaymentItem } from "@/components/payments/delete-payment-item";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listPayments } from "@/lib/services/payments";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Payments" };

export default async function PaymentsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = (await props.searchParams) || {};
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;

  const { payments, total, pageSize } = await listPayments({ q, page });
  const isFiltered = Boolean(q);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Every payment received against an invoice."
        actions={
          <Button asChild>
            <Link href="/payments/new">
              <Plus className="size-4" /> Record Payment
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <TableToolbar placeholder="Search by customer, invoice, reference…" />
        </div>

        {payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={isFiltered ? "No payments match your search" : "No payments yet"}
            description={
              isFiltered
                ? "Try a different search term."
                : "Payments recorded against invoices will show up here."
            }
            action={
              !isFiltered && (
                <Button asChild size="sm">
                  <Link href="/payments/new">
                    <Plus className="size-4" /> Record Payment
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Invoice</TableHead>
                <TableHead className="hidden lg:table-cell">Method</TableHead>
                <TableHead className="hidden xl:table-cell">Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell>
                    <Link href={`/customers/${p.customer.id}`} className="hover:underline">
                      {p.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={`/invoices/${p.invoice.id}`} className="font-medium text-primary hover:underline">
                      {p.invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell"><PaymentMethodBadge method={p.method} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">{p.referenceNumber || "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(p.amountPaise)}</TableCell>
                  <TableCell>
                    <RowActionsBar>
                      <QuickAction icon={Eye} label="View" href={`/payments/${p.id}`} />
                      <DeletePaymentItem paymentId={p.id} />
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
