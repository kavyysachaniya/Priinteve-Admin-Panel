import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/services/orders";
import { OrderDetail } from "@/components/orders/order-detail";

export const metadata = { title: "Order Details — Priinteve Business OS" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  return <OrderDetail order={order} />;
}

