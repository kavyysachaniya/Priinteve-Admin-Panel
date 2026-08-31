"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ShoppingBag, Calendar, CheckCircle2, Truck, Edit, Trash2, ArrowRight } from "lucide-react";
import { OrderStatusBadge, OrderPriorityBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { formatCurrency } from "@/lib/money";
import { updateOrderStatusAction, deleteOrderAction } from "@/lib/actions/orders";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";

export function OrderDetail({ order }: { order: any }) {
  const router = useRouter();

  const handleUpdateStatus = async (status: OrderStatus) => {
    const res = await updateOrderStatusAction(order.id, status);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Order {order.number}</h1>
            <OrderStatusBadge status={order.status} />
            <OrderPriorityBadge priority={order.priority} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Customer:{" "}
            <Link href={`/customers/${order.customer.id}`} className="font-semibold text-primary hover:underline">
              {order.customer.name}
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {order.status === "DRAFT" && (
            <Button size="sm" onClick={() => handleUpdateStatus("CONFIRMED")}>
              Confirm Order
            </Button>
          )}

          {order.status === "CONFIRMED" && (
            <Button size="sm" onClick={() => handleUpdateStatus("IN_PRODUCTION")}>
              Send to Production
            </Button>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href={`/orders/${order.id}/edit`}>
              <Edit className="size-3.5 mr-1" /> Edit
            </Link>
          </Button>

          <ConfirmDialog
            title="Delete Order"
            description="Are you sure you want to delete this order?"
            onConfirm={async () => {
              const res = await deleteOrderAction(order.id);
              if (res.success) router.push("/orders");
              return res;
            }}
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-3.5" />
              </Button>
            }
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Order Date</p>
          <p className="text-sm font-semibold">{format(new Date(order.orderDate), "d MMM yyyy")}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Target Completion</p>
          <p className="text-sm font-semibold">
            {order.expectedCompletionDate ? format(new Date(order.expectedCompletionDate), "d MMM yyyy") : "Not set"}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Production Stage</p>
          <p className="text-sm font-semibold">
            {order.productionJobs.length > 0 ? (
              <span>{order.productionJobs.length} active jobs</span>
            ) : (
              <span className="text-muted-foreground italic">No production jobs</span>
            )}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total Order Amount</p>
          <p className="text-lg font-bold text-primary">{formatCurrency(order.totalPaise)}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">Line Items ({order.items.length})</TabsTrigger>
          <TabsTrigger value="production">Production ({order.productionJobs.length})</TabsTrigger>
          <TabsTrigger value="delivery">Delivery Status</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item: any, idx: number) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-xs font-semibold">{item.name}</TableCell>
                      <TableCell className="text-xs">{item.quantity}</TableCell>
                      <TableCell className="text-xs">{formatCurrency(item.ratePaise)}</TableCell>
                      <TableCell className="text-right text-xs font-bold">{formatCurrency(item.amountPaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Associated Production Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {order.productionJobs.length === 0 ? (
                <p className="text-muted-foreground italic">No production jobs generated for this order yet.</p>
              ) : (
                order.productionJobs.map((job: any) => (
                  <div key={job.id} className="p-3 border rounded-lg flex justify-between items-center">
                    <div>
                      <Link href={`/production/${job.id}`} className="font-bold text-primary hover:underline">
                        {job.itemName}
                      </Link>
                      <span className="text-muted-foreground ml-2 text-[11px] font-mono">Stage: {job.status}</span>
                    </div>
                    <Button asChild size="xs" variant="ghost">
                      <Link href={`/production/${job.id}`} className="flex items-center gap-1">
                        View Job <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Delivery & Shipping Information</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              {order.delivery ? (
                <div className="space-y-1">
                  <p>Tracking Number: <span className="font-mono font-bold">{order.delivery.trackingNumber ?? "N/A"}</span></p>
                  <p>Status: <span className="font-semibold">{order.delivery.status}</span></p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href={`/deliveries/${order.delivery.id}`}>View Delivery Details</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground italic">No delivery scheduled yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={order.activityLogs ?? []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

