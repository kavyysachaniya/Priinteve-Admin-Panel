import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { OrderList } from "@/components/orders/order-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listOrders } from "@/lib/services/orders";
import { Plus } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

export const metadata = { title: "Orders — Priinteve Business OS" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const data = await listOrders({ q: params.q, status: params.status as OrderStatus, page });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Print Orders"
        description="Manage customer print jobs, production stages, and fulfillment status."
        actions={
          <Button asChild size="sm">
            <Link href="/orders/new">
              <Plus className="size-4 mr-1" /> New Order
            </Link>
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-4">
        <TableFilterSelect
          paramName="status"
          placeholder="All Statuses"
          options={[
            { label: "Draft", value: "DRAFT" },
            { label: "Confirmed", value: "CONFIRMED" },
            { label: "In Production", value: "IN_PRODUCTION" },
            { label: "Ready", value: "READY" },
            { label: "Out for Delivery", value: "OUT_FOR_DELIVERY" },
            { label: "Delivered", value: "DELIVERED" },
            { label: "Completed", value: "COMPLETED" },
            { label: "Cancelled", value: "CANCELLED" },
          ]}
        />
      </div>

      <OrderList orders={data.orders} />
      <TablePagination total={data.total} page={data.page} pageSize={data.pageSize} />
    </div>
  );
}
