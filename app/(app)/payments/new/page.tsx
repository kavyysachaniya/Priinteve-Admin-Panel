import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentForm } from "@/components/payments/payment-form";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { listPayableInvoices } from "@/lib/services/payments";
import { paymentFormDefaults } from "@/lib/validations/payment";

export const metadata = { title: "Record Payment" };

export default async function NewPaymentPage({ searchParams }: PageProps<"/payments/new">) {
  const sp = await searchParams;
  const invoiceIdParam = typeof sp.invoiceId === "string" ? sp.invoiceId : undefined;

  const [customers, invoices] = await Promise.all([listAllActiveCustomers(), listPayableInvoices()]);

  const preselected = invoiceIdParam ? invoices.find((inv) => inv.id === invoiceIdParam) : undefined;
  if (invoiceIdParam && !preselected) {
    // Invoice either doesn't exist or has nothing outstanding — don't silently ignore it.
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Record Payment" backHref="/payments" description="Log a payment received against an invoice." />
      <PaymentForm
        customers={customers}
        invoices={invoices}
        defaultValues={paymentFormDefaults(
          preselected ? { customerId: preselected.customerId, invoiceId: preselected.id } : undefined
        )}
      />
    </div>
  );
}
