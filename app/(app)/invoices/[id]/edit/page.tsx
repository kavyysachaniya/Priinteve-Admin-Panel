import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { getInvoiceDetail, invoiceToFormValues } from "@/lib/services/invoices";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { listAllActiveProducts } from "@/lib/services/products";

export const metadata = { title: "Edit Invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const { id } = await params;
  const invoice = await getInvoiceDetail(id);
  if (!invoice) notFound();

  const isEditable = !invoice.sourceQuotationId && invoice.amountPaidPaise === 0 && invoice.status !== "CANCELLED";
  if (!isEditable) notFound();

  const [customers, products] = await Promise.all([listAllActiveCustomers(), listAllActiveProducts()]);

  return (
    <div>
      <PageHeader title={`Edit ${invoice.number}`} backHref={`/invoices/${invoice.id}`} />
      <InvoiceForm
        invoiceId={invoice.id}
        invoiceNumber={invoice.number}
        defaultValues={invoiceToFormValues(invoice)}
        customers={customers}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          unit: p.unit,
          sellingPricePaise: p.sellingPricePaise,
          gstRate: p.gstRate,
          type: p.type,
        }))}
      />
    </div>
  );
}
