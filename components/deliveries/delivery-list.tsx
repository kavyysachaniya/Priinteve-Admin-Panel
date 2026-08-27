"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Truck } from "lucide-react";
import { DeliveryStatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function DeliveryList({ deliveries }: { deliveries: any[] }) {
  if (deliveries.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground italic">
        No delivery dispatches found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Delivery #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead>Method & Courier</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
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
              <TableCell className="text-xs">
                <Link href={`/orders/${delivery.order.id}`} className="text-primary hover:underline">
                  {delivery.order.number}
                </Link>
              </TableCell>
              <TableCell className="text-xs">
                <span className="font-medium text-foreground">{delivery.deliveryMethod.replace("_", " ")}</span>
                {delivery.courierPartner && (
                  <span className="text-muted-foreground block text-[11px]">{delivery.courierPartner} {delivery.trackingNumber ? `(${delivery.trackingNumber})` : ""}</span>
                )}
              </TableCell>
              <TableCell className="text-xs">{format(new Date(delivery.deliveryDate), "d MMM yyyy")}</TableCell>
              <TableCell>
                <DeliveryStatusBadge status={delivery.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

