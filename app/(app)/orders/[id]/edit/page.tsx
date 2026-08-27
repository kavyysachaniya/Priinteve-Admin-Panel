export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getOrderDetail, orderToFormValues } from "@/lib/services/orders";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { OrderForm } from "@/components/orders/order-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Edit Order — Priinteve Business OS" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, customers] = await Promise.all([
    getOrderDetail(id),
    listAllActiveCustomers(),
  ]);

  if (!order) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={`Edit Order: ${order.number}`} description="Update order specifications and line items." />
      <OrderForm orderId={order.id} defaultValues={orderToFormValues(order)} customers={customers} />
    </div>
  );
}

