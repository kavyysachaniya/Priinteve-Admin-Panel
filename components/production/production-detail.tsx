"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, User, Calendar, Package } from "lucide-react";
import { ProductionStatusBadge, OrderPriorityBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { updateProductionJobStatusAction } from "@/lib/actions/production";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ProductionStatus } from "@prisma/client";

const STAGE_LABELS: Record<ProductionStatus, string> = {
  PENDING: "Pending Handoff",
  ASSIGNED: "Assigned & Prepress",
  IN_PROGRESS: "In Printing",
  QUALITY_CHECK: "Quality Check",
  COMPLETED: "Completed (Ready)",
  ON_HOLD: "On Hold",
};

export function ProductionDetail({ job }: { job: any }) {
  const router = useRouter();

  const handleUpdateStatus = async (status: ProductionStatus) => {
    const res = await updateProductionJobStatusAction(job.id, status);
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Production Job {job.number}</h1>
            <ProductionStatusBadge status={job.status} />
            <OrderPriorityBadge priority={job.priority} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Item: <span className="font-semibold text-foreground">{job.itemName}</span> ({job.quantity} units)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={job.status} onValueChange={(v) => handleUpdateStatus(v as ProductionStatus)}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STAGE_LABELS) as ProductionStatus[]).map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {job.status !== "COMPLETED" && (
            <Button size="sm" onClick={() => handleUpdateStatus("COMPLETED")} className="bg-success/15 text-success hover:bg-success/25">
              <CheckCircle2 className="size-3.5" /> Mark Completed
            </Button>
          )}
        </div>
      </div>

      {/* Job / Order / Customer */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Package className="size-4" /> Job Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Item:</span>{" "}
              <span className="font-semibold text-foreground">{job.itemName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Quantity:</span>{" "}
              <span className="font-semibold text-foreground">{job.quantity} units</span>
            </div>
            {job.product && (
              <div>
                <span className="text-muted-foreground">Product:</span>{" "}
                <span className="font-semibold text-foreground">{job.product.name}</span>
              </div>
            )}
            {job.internalNotes && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Internal Notes:</span>
                <p className="bg-muted p-2 rounded text-foreground mt-1 whitespace-pre-wrap">{job.internalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <User className="size-4" /> Order & Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Order:</span>{" "}
              <Link href={`/orders/${job.order.id}`} className="font-semibold text-primary hover:underline">
                {job.order.number}
              </Link>
            </div>
            <div>
              <span className="text-muted-foreground">Customer:</span>{" "}
              <Link href={`/customers/${job.customerId}`} className="font-semibold text-primary hover:underline">
                {job.order.customer.name}
              </Link>
            </div>
            <div>
              <span className="text-muted-foreground">Assigned Operator:</span>{" "}
              <span className="font-semibold text-foreground">{job.assignedTo ? job.assignedTo.name : "Unassigned"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Calendar className="size-4" /> Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-xs">
          <div>
            <p className="text-muted-foreground">Start Date</p>
            <p className="font-semibold text-foreground mt-0.5">
              {job.startDate ? format(new Date(job.startDate), "PPP") : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Target Completion</p>
            <p className="font-semibold text-foreground mt-0.5">
              {job.expectedCompletionDate ? format(new Date(job.expectedCompletionDate), "PPP") : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Actual Completion</p>
            <p className="font-semibold text-foreground mt-0.5">
              {job.actualCompletionDate ? format(new Date(job.actualCompletionDate), "PPP") : "Not yet"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Stage Transition History ({job.history.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {job.history.length === 0 ? (
            <p className="text-muted-foreground italic">No stage changes recorded yet.</p>
          ) : (
            job.history.map((h: any) => (
              <div key={h.id} className="flex justify-between items-center p-2 bg-muted/40 rounded">
                <span className="font-medium text-foreground">{STAGE_LABELS[h.status as ProductionStatus] ?? h.status}</span>
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
          <ActivityTimeline items={job.activityLogs} />
        </CardContent>
      </Card>
    </div>
  );
}
