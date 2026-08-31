"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ShoppingBag, Eye, Pencil } from "lucide-react";
import { OrderStatusBadge, OrderPriorityBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { QuickAction, RowActionsBar } from "@/components/shared/row-actions";
import { DeleteOrderItem } from "@/components/orders/delete-order-item";
import { formatCurrency } from "@/lib/money";

export function OrderList({ orders }: { orders: any[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="No orders found"
        description="Orders are created directly or converted from an accepted quotation."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden lg:table-cell">Title</TableHead>
            <TableHead className="hidden md:table-cell">Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Order Date</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="w-10" />
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
              <TableCell className="hidden text-xs font-medium lg:table-cell">{order.notes ?? "Print Order"}</TableCell>
              <TableCell className="hidden md:table-cell">
                <OrderPriorityBadge priority={order.priority} />
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className="hidden text-xs md:table-cell">{format(new Date(order.orderDate), "d MMM yyyy")}</TableCell>
              <TableCell className="text-right text-sm font-bold">
                {formatCurrency(order.totalPaise)}
              </TableCell>
              <TableCell>
                <RowActionsBar>
                  <QuickAction icon={Eye} label="View" href={`/orders/${order.id}`} />
                  <QuickAction icon={Pencil} label="Edit" href={`/orders/${order.id}/edit`} />
                  <DeleteOrderItem orderId={order.id} orderNumber={order.number} />
                </RowActionsBar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
