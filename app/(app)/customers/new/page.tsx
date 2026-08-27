export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata = { title: "New Customer" };

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add Customer" backHref="/customers" description="Create a new individual or business customer." />
      <CustomerForm />
    </div>
  );
}
