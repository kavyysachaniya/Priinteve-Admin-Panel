export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, FileText, ReceiptText, Mail, Phone, MapPin, Building2, ShoppingBag, CheckSquare, StickyNote } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import {
  CustomerStatusBadge,
  QuotationStatusBadge,
  InvoiceStatusBadge,
  PaymentMethodBadge,
  OrderStatusBadge,
  TaskStatusBadge,
} from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCustomerWithFinancials } from "@/lib/services/customers";
import { formatCurrency } from "@/lib/money";
import { formatDate, initials } from "@/lib/format";

export const metadata = { title: "Customer Details — Priinteve Business OS" };

export default async function CustomerDetailPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const data = await getCustomerWithFinancials(id);
  if (!data) notFound();

  const { customer, financials, activity } = data;

  return (
    <div>
      <PageHeader
        backHref="/customers"
        title={
          <span className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initials(customer.name)}
              </AvatarFallback>
            </Avatar>
            {customer.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1"><Phone className="size-3.5" />{customer.phone}</span>
            {customer.email && <span className="flex items-center gap-1"><Mail className="size-3.5" />{customer.email}</span>}
            <CustomerStatusBadge status={customer.status} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/customers/${customer.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/quotations/new?customerId=${customer.id}`}>
                <FileText className="size-4" /> New Quotation
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/orders/new?customerId=${customer.id}`}>
                <ShoppingBag className="size-4" /> New Order
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/invoices/new?customerId=${customer.id}`}>
                <ReceiptText className="size-4" /> New Invoice
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Business" value={formatCurrency(financials.totalBusinessPaise)} />
        <StatCard label="Total Paid" value={formatCurrency(financials.totalPaidPaise)} />
        <StatCard
          label="Outstanding"
          value={formatCurrency(financials.outstandingPaise)}
          changeDirection={financials.outstandingPaise > 0 ? "down" : "neutral"}
        />
        <StatCard label="Quotations" value={String(financials.quotationsCount)} />
        <StatCard label="Orders" value={String(financials.ordersCount)} />
        <StatCard label="Invoices" value={String(financials.invoicesCount)} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders ({customer.orders.length})</TabsTrigger>
          <TabsTrigger value="quotations">Quotations ({customer.quotations.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({customer.invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({customer.payments.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({customer.tasks.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({customer.notesList.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Building2 className="size-4" /> Business Details
            </h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="Type" value={customer.type === "BUSINESS" ? "Business" : "Individual"} />
              {customer.contactPerson && <Row label="Contact Person" value={customer.contactPerson} />}
              <Row label="GSTIN" value={customer.gstin ?? "—"} />
              <Row label="PAN" value={customer.pan ?? "—"} />
              <Row label="Tags" value={customer.tags ?? "—"} />
            </dl>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <MapPin className="size-4" /> Address
            </h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="Billing" value={customer.billingAddress ?? "—"} />
              <Row label="Shipping" value={customer.shippingAddress || customer.billingAddress || "—"} />
              <Row label="City / State" value={[customer.city, customer.state].filter(Boolean).join(", ") || "—"} />
              <Row label="Pincode" value={customer.pincode ?? "—"} />
            </dl>
          </div>
          {customer.notes && (
            <div className="rounded-lg border bg-card p-5 lg:col-span-2">
              <h3 className="mb-2 text-sm font-semibold">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{customer.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders">
          {customer.orders.length === 0 ? (
            <EmptyState title="No orders yet" description="Create the first order for this customer." />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                          {o.number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(o.orderDate)}</TableCell>
                      <TableCell>{o.priority}</TableCell>
                      <TableCell className="text-right">{formatCurrency(o.totalPaise)}</TableCell>
                      <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quotations">
          {customer.quotations.length === 0 ? (
            <EmptyState title="No quotations yet" description="Create the first quotation for this customer." />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.quotations.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Link href={`/quotations/${q.id}`} className="font-medium text-primary hover:underline">
                          {q.number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(q.issueDate)}</TableCell>
                      <TableCell>{formatDate(q.validUntil)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(q.totalPaise)}</TableCell>
                      <TableCell><QuotationStatusBadge status={q.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices">
          {customer.invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Create the first invoice for this customer." />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                      <TableCell>{formatDate(inv.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.totalPaise)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(inv.totalPaise - inv.amountPaidPaise)}
                      </TableCell>
                      <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          {customer.payments.length === 0 ? (
            <EmptyState title="No payments yet" description="Payments recorded against this customer's invoices will appear here." />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.paymentDate)}</TableCell>
                      <TableCell>
                        <Link href={`/invoices/${p.invoiceId}`} className="font-medium text-primary hover:underline">
                          {p.invoice.number}
                        </Link>
                      </TableCell>
                      <TableCell><PaymentMethodBadge method={p.method} /></TableCell>
                      <TableCell className="text-muted-foreground">{p.referenceNumber || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(p.amountPaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {customer.tasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Create a task related to this customer." />
          ) : (
            <div className="rounded-lg border bg-card p-4 space-y-2 text-xs">
              {customer.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2 rounded border">
                  <Link href={`/tasks/${task.id}`} className="font-semibold hover:underline">
                    {task.title}
                  </Link>
                  <TaskStatusBadge status={task.status} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          {customer.notesList.length === 0 ? (
            <EmptyState title="No notes yet" description="Add a note attached to this customer." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              {customer.notesList.map((note) => (
                <div key={note.id} className="p-3 border rounded-md bg-card">
                  <Link href={`/notes/${note.id}`} className="font-bold hover:underline block mb-1">
                    {note.title}
                  </Link>
                  <p className="text-muted-foreground line-clamp-3">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <div className="max-w-xl rounded-lg border bg-card p-5">
            <ActivityTimeline items={activity} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
