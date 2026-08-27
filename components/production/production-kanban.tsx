"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Factory, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { updateProductionJobStatusAction } from "@/lib/actions/production";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ProductionStatus } from "@prisma/client";

const STAGES: Array<{ key: ProductionStatus; label: string; color: string }> = [
  { key: "PENDING", label: "Pending Handoff", color: "bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300" },
  { key: "ASSIGNED", label: "Assigned & Prepress", color: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300" },
  { key: "IN_PROGRESS", label: "In Printing", color: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300" },
  { key: "QUALITY_CHECK", label: "Quality Check", color: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300" },
  { key: "COMPLETED", label: "Completed (Ready)", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" },
];

export function ProductionKanban({ initialJobs }: { initialJobs: any[] }) {
  const router = useRouter();

  const handleMoveStage = async (id: string, nextStatus: ProductionStatus) => {
    const res = await updateProductionJobStatusAction(id, nextStatus);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const stageJobs = initialJobs.filter((j) => j.status === stage.key);
        return (
          <div key={stage.key} className="space-y-3 min-w-[220px]">
            <div className={`p-2.5 rounded-lg border font-semibold text-xs flex items-center justify-between ${stage.color}`}>
              <span>{stage.label}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-background/80">
                {stageJobs.length}
              </span>
            </div>

            <div className="space-y-3 min-h-[400px]">
              {stageJobs.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground italic">
                  No jobs
                </div>
              ) : (
                stageJobs.map((job) => (
                  <Card key={job.id} className="p-3 space-y-2 text-xs hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between font-semibold">
                      <Link href={`/production/${job.id}`} className="text-primary hover:underline font-bold">
                        {job.number}
                      </Link>
                      <span className="text-[11px] text-muted-foreground font-mono">{job.order.number}</span>
                    </div>

                    <p className="font-semibold text-foreground line-clamp-2">{job.itemName}</p>
                    <p className="text-muted-foreground text-[11px]">Customer: {job.order.customer.name}</p>

                    {job.expectedCompletionDate && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1 border-t">
                        <Clock className="size-3" />
                        <span>Due {format(new Date(job.expectedCompletionDate), "d MMM")}</span>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between text-[11px]">
                      {stage.key !== "PENDING" && (
                        <button
                          onClick={() => {
                            const prevIdx = STAGES.findIndex((s) => s.key === stage.key) - 1;
                            if (prevIdx >= 0) handleMoveStage(job.id, STAGES[prevIdx].key);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ← Prev
                        </button>
                      )}
                      {stage.key !== "COMPLETED" && (
                        <button
                          onClick={() => {
                            const nextIdx = STAGES.findIndex((s) => s.key === stage.key) + 1;
                            if (nextIdx < STAGES.length) handleMoveStage(job.id, STAGES[nextIdx].key);
                          }}
                          className="text-primary font-semibold hover:underline ml-auto"
                        >
                          Next →
                        </button>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

