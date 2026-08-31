export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { Button } from "@/components/ui/button";
import { DeliveryList } from "@/components/deliveries/delivery-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TableDateFilter } from "@/components/shared/table-date-filter";
import { TablePagination } from "@/components/shared/table-pagination";
import { listDeliveries, getDeliveryStatusCounts, listAssignedPersons } from "@/lib/services/deliveries";
import type { DeliveryStatus } from "@prisma/client";

export const metadata = { title: "Deliveries — Priinteve Business OS" };

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Pending",
  SCHEDULED: "Scheduled",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RETURNED: "Returned",
};

export default async function DeliveriesPage(props: {
  searchParams: Promise<{ q?: string; status?: string; assignedPerson?: string; deliveryDate?: string; page?: string }>;
}) {
  const searchParams = (await props.searchParams) || {};
  const q = searchParams.q ?? "";
  const status = searchParams.status as DeliveryStatus | undefined;
  const assignedPerson = searchParams.assignedPerson ?? "";
  const deliveryDate = searchParams.deliveryDate ?? "";
  const page = Number(searchParams.page ?? 1);

  const [{ deliveries, total, pageSize }, statusCounts, assignedPersons] = await Promise.all([
    listDeliveries({ q, status, assignedPerson, deliveryDate, page }),
    getDeliveryStatusCounts(),
    listAssignedPersons(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries & Dispatches"
        description="Track outbound order dispatches, couriers, and delivery tracking."
        actions={
          <Button asChild size="sm">
            <Link href="/deliveries/new">
              <Plus className="size-4" /> New Delivery
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((s) => (
          <Link key={s} href={`/deliveries?status=${s}`}>
            <StatCard label={STATUS_LABELS[s]} value={String(statusCounts[s])} />
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TableToolbar placeholder="Search by delivery #, tracking #, address…">
          <TableFilterSelect
            paramName="status"
            placeholder="All Statuses"
            options={(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
          {assignedPersons.length > 0 && (
            <TableFilterSelect
              paramName="assignedPerson"
              placeholder="All Assignees"
              options={assignedPersons.map((p) => ({ value: p, label: p }))}
            />
          )}
          <TableDateFilter paramName="deliveryDate" label="Filter by delivery date" />
        </TableToolbar>
      </div>

      <DeliveryList deliveries={deliveries} />
      <TablePagination total={total} pageSize={pageSize} page={page} />
    </div>
  );
}
