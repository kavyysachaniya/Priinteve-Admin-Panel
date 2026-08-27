"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Factory, Clock, CheckCircle2, User } from "lucide-react";
import { ProductionStatusBadge, OrderPriorityBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateProductionJobStatusAction } from "@/lib/actions/production";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ProductionStatus } from "@prisma/client";

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
          {job.status !== "COMPLETED" && (
            <Button size="sm" onClick={() => handleUpdateStatus("COMPLETED")} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="size-3.5 mr-1" /> Mark Job Completed
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Job Specifications & Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Parent Order:</span>{" "}
              <Link href={`/orders/${job.order.id}`} className="font-semibold text-primary hover:underline">
                {job.order.number} ({job.order.title})
              </Link>
            </div>
            <div>
              <span className="text-muted-foreground">Customer:</span>{" "}
              <span className="font-semibold text-foreground">{job.order.customer.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Quantity:</span>{" "}
              <span className="font-semibold text-foreground">{job.quantity} units</span>
            </div>
            {job.specifications && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Technical Specifications:</span>
                <p className="bg-muted p-2 rounded text-foreground mt-1 whitespace-pre-wrap">{job.specifications}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Stage & History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div>
              <span className="text-muted-foreground">Assigned Operator:</span>{" "}
              <span className="font-semibold text-foreground">{job.assignedTo ? job.assignedTo.name : "Unassigned"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Target Completion:</span>{" "}
              <span className="font-semibold text-foreground">
                {job.expectedCompletionDate ? format(new Date(job.expectedCompletionDate), "PPP") : "Not set"}
              </span>
            </div>

            <div className="pt-3 border-t space-y-2">
              <p className="font-semibold text-muted-foreground">Stage Transition Logs ({job.history.length})</p>
              {job.history.map((h: any) => (
                <div key={h.id} className="flex justify-between items-center text-[11px] p-2 bg-muted/40 rounded">
                  <span className="font-medium text-foreground">{h.status}</span>
                  <span className="text-muted-foreground">{format(new Date(h.createdAt), "d MMM, p")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

