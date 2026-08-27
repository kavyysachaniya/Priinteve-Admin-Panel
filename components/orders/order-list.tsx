"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ShoppingBag } from "lucide-react";
import { OrderStatusBadge, OrderPriorityBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/money";

export function OrderList({ orders }: { orders: any[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground italic">
        No orders found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Order Date</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-semibold text-xs">
                <Link href={`/orders/${order.id}`} className="text-primary hover:underline flex items-center gap-1.5">
                  <ShoppingBag className="size-3.5" /> {order.number}
                </Link>
              </TableCell>
              <TableCell className="text-xs font-medium">
                <Link href={`/customers/${order.customer.id}`} className="hover:underline">
                  {order.customer.name}
                </Link>
              </TableCell>
              <TableCell className="text-xs font-medium">{order.notes ?? "Print Order"}</TableCell>
              <TableCell>
                <OrderPriorityBadge priority={order.priority} />
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className="text-xs">{format(new Date(order.orderDate), "d MMM yyyy")}</TableCell>
              <TableCell className="text-right text-sm font-bold">
                {formatCurrency(order.totalPaise)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

