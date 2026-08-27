export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/page-header";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { listAllActiveProducts } from "@/lib/services/products";
import { quotationFormDefaults } from "@/lib/validations/quotation";
import { emptyDocumentItem } from "@/lib/validations/document-item";

export const metadata = { title: "New Quotation" };

export default async function NewQuotationPage({ searchParams }: PageProps<"/quotations/new">) {
  const sp = await searchParams;
  const customerId = typeof sp.customerId === "string" ? sp.customerId : undefined;

  const [customers, products] = await Promise.all([listAllActiveCustomers(), listAllActiveProducts()]);

  return (
    <div>
      <PageHeader title="New Quotation" backHref="/quotations" description="Build a quotation and share it with your customer." />
      <QuotationForm
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
        defaultValues={quotationFormDefaults({
          customerId: customerId ?? "",
          items: [emptyDocumentItem],
        })}
      />
    </div>
  );
}
