export const dynamic = "force-dynamic";
import Link from "next/link";
import { Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listOrdersForPicker, getOrderDetail } from "@/lib/services/orders";
import { DeliveryForm } from "@/components/deliveries/delivery-form";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "New Delivery — Priinteve Business OS" };

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  try {
    await requirePermission("deliveries:create");
  } catch {
    redirect("/deliveries");
  }

  const { orderId } = await searchParams;

  if (!orderId) {
    const orders = await listOrdersForPicker({ requireNoDelivery: true });

    return (
      <div className="space-y-6">
        <PageHeader
          title="New Delivery"
          description="Choose the order to dispatch. Only orders without an existing delivery are shown."
          backHref="/deliveries"
        />
        {orders.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No orders ready for delivery"
            description="Every order either already has a delivery or none exist yet."
            action={
              <Button asChild size="sm">
                <Link href="/orders/new">New Order</Link>
              </Button>
            }
          />
        ) : (
          <form method="GET" className="max-w-lg space-y-4 rounded-lg border bg-card p-5">
            <div className="space-y-1.5">
              <label htmlFor="orderId" className="text-sm font-medium">
                Order
              </label>
              <select
                id="orderId"
                name="orderId"
                required
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Choose an order…
                </option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.number} — {o.customer.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Continue</Button>
          </form>
        )}
      </div>
    );
  }

  const order = await getOrderDetail(orderId);

  if (!order || order.delivery) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Delivery" backHref="/deliveries/new" />
        <EmptyState
          icon={Truck}
          title={order ? "This order already has a delivery" : "Order not found"}
          description="Choose a different order to continue."
          action={
            <Button asChild size="sm">
              <Link href="/deliveries/new">Choose Order</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Delivery"
        description={`For order ${order.number} — ${order.customer.name}`}
        backHref="/deliveries/new"
      />
      <DeliveryForm
        order={{
          id: order.id,
          number: order.number,
          deliveryAddress: order.customer.shippingAddress || order.customer.billingAddress || "",
          contactNumber: order.customer.phone || "",
        }}
      />
    </div>
  );
}
