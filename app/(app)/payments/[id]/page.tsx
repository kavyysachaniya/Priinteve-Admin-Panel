import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentMethodBadge } from "@/components/shared/status-badge";
import { DeletePaymentButton } from "@/components/payments/delete-payment-button";
import { getPaymentDetail } from "@/lib/services/payments";
import { formatCurrency } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Payment Details" };

export default async function PaymentDetailPage({ params }: PageProps<"/payments/[id]">) {
  const { id } = await params;
  const payment = await getPaymentDetail(id);
  if (!payment) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        backHref="/payments"
        title={formatCurrency(payment.amountPaise)}
        description={`Recorded ${formatDateTime(payment.createdAt)}`}
        actions={<DeletePaymentButton paymentId={id} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <UserRound className="size-4" /> Customer
          </h3>
          <Link href={`/customers/${payment.customer.id}`} className="font-medium text-primary hover:underline">
            {payment.customer.name}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{payment.customer.phone}</p>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <ReceiptText className="size-4" /> Invoice
          </h3>
          <Link href={`/invoices/${payment.invoice.id}`} className="font-medium text-primary hover:underline">
            {payment.invoice.number}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">Total {formatCurrency(payment.invoice.totalPaise)}</p>
        </div>

        <div className="rounded-lg border bg-card p-5 sm:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Payment Details</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Payment Date" value={formatDate(payment.paymentDate)} />
            <Row label="Amount" value={formatCurrency(payment.amountPaise)} />
            <Row label="Method" value={<PaymentMethodBadge method={payment.method} />} />
            <Row label="Reference" value={payment.referenceNumber || "—"} />
          </dl>
          {payment.notes && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{payment.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
