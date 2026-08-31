"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Truck, MapPin, User, Package } from "lucide-react";
import { DeliveryStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateDeliveryStatusAction } from "@/lib/actions/deliveries";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { DeliveryStatus } from "@prisma/client";

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Pending",
  SCHEDULED: "Scheduled",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RETURNED: "Returned",
};

export function DeliveryDetail({ delivery }: { delivery: any }) {
  const router = useRouter();

  const handleUpdateStatus = async (status: DeliveryStatus) => {
    const res = await updateDeliveryStatusAction(delivery.id, status);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Delivery {delivery.number}</h1>
            <DeliveryStatusBadge status={delivery.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Dispatch Date: {format(new Date(delivery.deliveryDate), "PPP")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {delivery.status === "PENDING" && (
            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus("OUT_FOR_DELIVERY")}>
              Mark Out for Delivery
            </Button>
          )}
          {delivery.status !== "DELIVERED" && (
            <Button size="sm" onClick={() => handleUpdateStatus("DELIVERED")} className="bg-success/15 text-success hover:bg-success/25">
              <Truck className="size-3.5" /> Mark Delivered
            </Button>
          )}
        </div>
      </div>

      {/* Recipient / Logistics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <User className="size-4" /> Recipient
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Customer:</span>{" "}
              <Link href={`/customers/${delivery.customer.id}`} className="font-semibold text-primary hover:underline">
                {delivery.customer.name}
              </Link>
            </div>
            <div>
              <span className="text-muted-foreground">Contact Number:</span>{" "}
              <span className="font-semibold text-foreground">{delivery.contactNumber || delivery.customer.phone}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Order:</span>{" "}
              <Link href={`/orders/${delivery.order.id}`} className="font-semibold text-primary hover:underline">
                {delivery.order.number}
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <MapPin className="size-4" /> Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            <p className="font-medium text-foreground bg-muted p-2 rounded whitespace-pre-wrap">
              {delivery.deliveryAddress || "Not set"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Logistics & Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Package className="size-4" /> Logistics & Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-xs">
          <div>
            <p className="text-muted-foreground">Method</p>
            <p className="font-semibold text-foreground mt-0.5">{delivery.deliveryMethod.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Assigned Person</p>
            <p className="font-semibold text-foreground mt-0.5">{delivery.assignedPerson || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tracking Waybill #</p>
            <p className="font-mono font-bold text-foreground mt-0.5">{delivery.trackingNumber || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Actual Delivery Date</p>
            <p className="font-semibold text-foreground mt-0.5">
              {delivery.actualDeliveryDate ? format(new Date(delivery.actualDeliveryDate), "PPP") : "Not yet"}
            </p>
          </div>
          {delivery.notes && (
            <div className="sm:col-span-3 pt-2 border-t">
              <p className="text-muted-foreground">Notes</p>
              <p className="font-medium text-foreground mt-1 whitespace-pre-wrap">{delivery.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Status History ({delivery.history.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {delivery.history.length === 0 ? (
            <p className="text-muted-foreground italic">No status changes recorded yet.</p>
          ) : (
            delivery.history.map((h: any) => (
              <div key={h.id} className="flex justify-between items-center p-2 bg-muted/40 rounded">
                <span className="font-medium text-foreground">{STATUS_LABELS[h.status as DeliveryStatus] ?? h.status}</span>
                <span className="text-muted-foreground">{format(new Date(h.createdAt), "d MMM, p")}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline items={delivery.activityLogs} />
        </CardContent>
      </Card>
    </div>
  );
}
