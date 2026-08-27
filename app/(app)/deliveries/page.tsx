import { PageHeader } from "@/components/shared/page-header";
import { DeliveryList } from "@/components/deliveries/delivery-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listDeliveries } from "@/lib/services/deliveries";
import type { DeliveryStatus } from "@prisma/client";

export const metadata = { title: "Deliveries — Priinteve Business OS" };

export default async function DeliveriesPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const searchParams = (await props.searchParams) || {};
  const q = searchParams.q ?? "";
  const status = searchParams.status as DeliveryStatus | undefined;
  const page = Number(searchParams.page ?? 1);

  const { deliveries, total, pageSize } = await listDeliveries({ q, status, page });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries & Dispatches"
        description="Track outbound order dispatches, couriers, and delivery tracking."
      />
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <TableFilterSelect
          paramName="status"
          placeholder="Filter by Status"
          options={[
            { label: "All Statuses", value: "" },
            { label: "Pending", value: "PENDING" },
            { label: "Scheduled", value: "SCHEDULED" },
            { label: "Out for Delivery", value: "OUT_FOR_DELIVERY" },
            { label: "Delivered", value: "DELIVERED" },
            { label: "Failed", value: "FAILED" },
            { label: "Returned", value: "RETURNED" },
          ]}
        />
      </div>
      <DeliveryList deliveries={deliveries} />
      <TablePagination total={total} pageSize={pageSize} page={page} />
    </div>
  );
}
