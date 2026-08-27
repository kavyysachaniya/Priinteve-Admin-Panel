import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomerById } from "@/lib/services/customers";

export const metadata = { title: "Edit Customer" };

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${customer.name}`} backHref={`/customers/${customer.id}`} />
      <CustomerForm
        customerId={customer.id}
        defaultValues={{
          type: customer.type,
          name: customer.name,
          contactPerson: customer.contactPerson ?? "",
          phone: customer.phone,
          whatsapp: customer.whatsapp ?? "",
          email: customer.email ?? "",
          gstin: customer.gstin ?? "",
          pan: customer.pan ?? "",
          billingAddress: customer.billingAddress ?? "",
          shippingAddress: customer.shippingAddress ?? "",
          city: customer.city ?? "",
          state: customer.state ?? "",
          pincode: customer.pincode ?? "",
          notes: customer.notes ?? "",
          tags: customer.tags ?? "",
          status: customer.status,
        }}
      />
    </div>
  );
}
