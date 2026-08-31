export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus, Users, Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { QuickAction, RowActionsBar } from "@/components/shared/row-actions";
import { CustomerStatusBadge } from "@/components/shared/status-badge";
import { DeleteCustomerItem } from "@/components/customers/delete-customer-item";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCustomers } from "@/lib/services/customers";
import { formatCurrency } from "@/lib/money";
import { formatDate, initials } from "@/lib/format";
import type { CustomerStatus } from "@prisma/client";

export const metadata = { title: "Customers" };

export default async function CustomersPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = (await props.searchParams) || {};
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? (sp.status as CustomerStatus) : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;

  const { customers, total, pageSize } = await listCustomers({ q, status, page });
  const isFiltered = Boolean(q || status);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone you do business with — individuals and companies."
        actions={
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="size-4" /> Add Customer
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <TableToolbar placeholder="Search by name, phone, email, GSTIN…">
            <TableFilterSelect
              paramName="status"
              placeholder="All statuses"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
          </TableToolbar>
        </div>

        {customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={isFiltered ? "No customers match your filters" : "No customers yet"}
            description={
              isFiltered
                ? "Try a different search term or clear filters."
                : "Add your first customer to start creating quotations and invoices."
            }
            action={
              !isFiltered && (
                <Button asChild size="sm">
                  <Link href="/customers/new">
                    <Plus className="size-4" /> Add Customer
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="text-right">Total Business</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="hidden lg:table-cell">Last Transaction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="max-w-[220px]">
                    <Link href={`/customers/${customer.id}`} className="flex items-center gap-2.5 py-1">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {initials(customer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" title={customer.name}>
                          {customer.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {customer.type === "BUSINESS" ? "Business" : "Individual"}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{customer.phone}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(customer.totalBusinessPaise)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {customer.outstandingPaise > 0 ? (
                      <span className="font-medium text-destructive">
                        {formatCurrency(customer.outstandingPaise)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">₹0.00</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {formatDate(customer.lastTransactionAt)}
                  </TableCell>
                  <TableCell>
                    <CustomerStatusBadge status={customer.status} />
                  </TableCell>
                  <TableCell>
                    <RowActionsBar>
                      <QuickAction icon={<Eye className="size-3.5" />} label="View" href={`/customers/${customer.id}`} />
                      <QuickAction icon={<Pencil className="size-3.5" />} label="Edit" href={`/customers/${customer.id}/edit`} />
                      <DeleteCustomerItem customerId={customer.id} customerName={customer.name} />
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
