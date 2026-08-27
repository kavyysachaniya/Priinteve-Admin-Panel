export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/page-header";
import { OrderForm } from "@/components/orders/order-form";
import { listAllActiveCustomers } from "@/lib/services/customers";

export const metadata = { title: "Create Order — Priinteve Business OS" };

export default async function NewOrderPage() {
  const customers = await listAllActiveCustomers();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Create Print Order" description="Book a new print job for a customer." />
      <OrderForm customers={customers} />
    </div>
  );
}

