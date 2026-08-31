"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Truck, Eye } from "lucide-react";
import { DeliveryStatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { QuickAction, RowActionsBar } from "@/components/shared/row-actions";

export function DeliveryList({ deliveries }: { deliveries: any[] }) {
  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No deliveries found"
        description="Deliveries are created from orders once they're ready to dispatch."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Delivery #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden md:table-cell">Order #</TableHead>
            <TableHead className="hidden lg:table-cell">Method & Tracking</TableHead>
            <TableHead className="hidden md:table-cell">Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map((delivery) => (
            <TableRow key={delivery.id}>
              <TableCell className="font-semibold text-xs">
                <Link href={`/deliveries/${delivery.id}`} className="text-primary hover:underline flex items-center gap-1.5">
                  <Truck className="size-3.5" /> {delivery.number}
                </Link>
              </TableCell>
              <TableCell className="text-xs font-medium">
                <Link href={`/customers/${delivery.customer.id}`} className="hover:underline">
                  {delivery.customer.name}
                </Link>
              </TableCell>
              <TableCell className="hidden text-xs md:table-cell">
                <Link href={`/orders/${delivery.order.id}`} className="text-primary hover:underline">
                  {delivery.order.number}
                </Link>
              </TableCell>
              <TableCell className="hidden text-xs lg:table-cell">
                <span className="font-medium text-foreground">{delivery.deliveryMethod.replace("_", " ")}</span>
                {(delivery.assignedPerson || delivery.trackingNumber) && (
                  <span className="text-muted-foreground block text-[11px]">
                    {delivery.assignedPerson}
                    {delivery.assignedPerson && delivery.trackingNumber ? " · " : ""}
                    {delivery.trackingNumber}
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden text-xs md:table-cell">{format(new Date(delivery.deliveryDate), "d MMM yyyy")}</TableCell>
              <TableCell>
                <DeliveryStatusBadge status={delivery.status} />
              </TableCell>
              <TableCell>
                <RowActionsBar>
                  <QuickAction icon={<Eye className="size-3.5" />} label="View" href={`/deliveries/${delivery.id}`} />
                </RowActionsBar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
