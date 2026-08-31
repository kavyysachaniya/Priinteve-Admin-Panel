export const dynamic = "force-dynamic";
import Link from "next/link";
import { Factory } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listOrdersForPicker, getOrderDetail } from "@/lib/services/orders";
import { listUsers } from "@/lib/services/users";
import { ProductionJobForm } from "@/components/production/production-job-form";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "New Production Job — Priinteve Business OS" };

export default async function NewProductionJobPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  try {
    await requirePermission("production:create");
  } catch {
    redirect("/production");
  }

  const { orderId } = await searchParams;

  if (!orderId) {
    const orders = await listOrdersForPicker();

    return (
      <div className="space-y-6">
        <PageHeader
          title="New Production Job"
          description="Choose the order this job belongs to."
          backHref="/production"
        />
        {orders.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="No eligible orders"
            description="Create an order first, then add a production job to it."
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

  const [order, users] = await Promise.all([getOrderDetail(orderId), listUsers()]);

  if (!order) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Production Job" backHref="/production/new" />
        <EmptyState
          icon={Factory}
          title="Order not found"
          description="Choose a different order to continue."
          action={
            <Button asChild size="sm">
              <Link href="/production/new">Choose Order</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const items = order.items.map((i) => ({
    id: i.id,
    name: i.name,
    productId: i.productId,
    quantity: i.quantity,
  }));
  const activeUsers = users.filter((u) => u.status === "ACTIVE").map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Production Job"
        description={`For order ${order.number} — ${order.customer.name}`}
        backHref="/production/new"
      />
      <ProductionJobForm
        order={{ id: order.id, number: order.number, priority: order.priority }}
        items={items}
        users={activeUsers}
      />
    </div>
  );
}
