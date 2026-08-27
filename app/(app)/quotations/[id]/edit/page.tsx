import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { getQuotationDetail, quotationToFormValues } from "@/lib/services/quotations";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { listAllActiveProducts } from "@/lib/services/products";

export const metadata = { title: "Edit Quotation" };

export default async function EditQuotationPage({ params }: PageProps<"/quotations/[id]/edit">) {
  const { id } = await params;
  const quotation = await getQuotationDetail(id);
  if (!quotation) notFound();
  if (quotation.status === "CONVERTED") {
    notFound();
  }

  const [customers, products] = await Promise.all([listAllActiveCustomers(), listAllActiveProducts()]);

  return (
    <div>
      <PageHeader title={`Edit ${quotation.number}`} backHref={`/quotations/${quotation.id}`} />
      <QuotationForm
        quotationId={quotation.id}
        quotationNumber={quotation.number}
        defaultValues={quotationToFormValues(quotation)}
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
