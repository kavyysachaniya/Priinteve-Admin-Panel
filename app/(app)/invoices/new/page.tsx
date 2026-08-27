export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { listAllActiveProducts } from "@/lib/services/products";
import { invoiceFormDefaults } from "@/lib/validations/invoice";
import { emptyDocumentItem } from "@/lib/validations/document-item";

export const metadata = { title: "New Invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const sp = await searchParams;
  const customerId = typeof sp.customerId === "string" ? sp.customerId : undefined;

  const [customers, products] = await Promise.all([listAllActiveCustomers(), listAllActiveProducts()]);

  return (
    <div>
      <PageHeader title="New Invoice" backHref="/invoices" description="Bill a customer directly, or convert an accepted quotation instead." />
      <InvoiceForm
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
        defaultValues={invoiceFormDefaults({
          customerId: customerId ?? "",
          items: [emptyDocumentItem],
        })}
      />
    </div>
  );
}
