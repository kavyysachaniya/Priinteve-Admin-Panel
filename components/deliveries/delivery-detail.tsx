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
          {delivery.status !== "DELIVERED" && (
            <Button size="sm" onClick={() => handleUpdateStatus("DELIVERED")} className="bg-emerald-600 hover:bg-emerald-700">
              <Truck className="size-3.5 mr-1" /> Mark Delivered
            </Button>
          )}
          {delivery.status === "PENDING" && (
            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus("OUT_FOR_DELIVERY")}>
              Mark Out for Delivery
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recipient & Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Recipient Name:</span>{" "}
              <span className="font-semibold text-foreground">{delivery.recipientName ?? delivery.customer.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Phone:</span>{" "}
              <span className="font-semibold text-foreground">{delivery.recipientPhone ?? delivery.customer.phone}</span>
            </div>
            {delivery.address && (
              <div>
                <span className="text-muted-foreground">Shipping Address:</span>
                <p className="font-medium text-foreground mt-0.5 bg-muted p-2 rounded">{delivery.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Logistics & Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Method:</span>{" "}
              <span className="font-semibold text-foreground">{delivery.deliveryMethod.replace("_", " ")}</span>
            </div>
            {delivery.courierPartner && (
              <div>
                <span className="text-muted-foreground">Courier Partner:</span>{" "}
                <span className="font-semibold text-foreground">{delivery.courierPartner}</span>
              </div>
            )}
            {delivery.trackingNumber && (
              <div>
                <span className="text-muted-foreground">Tracking Waybill #:</span>{" "}
                <span className="font-mono font-bold text-foreground">{delivery.trackingNumber}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

