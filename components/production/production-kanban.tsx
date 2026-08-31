"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, User, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProductionJobStatusAction } from "@/lib/actions/production";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ProductionStatus } from "@prisma/client";

interface StageConfig {
  key: ProductionStatus;
  label: string;
  badgeBg: string;
  headerBorder: string;
  accentText: string;
}

const STAGES: StageConfig[] = [
  {
    key: "PENDING",
    label: "Pending Handoff",
    badgeBg: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
    headerBorder: "border-slate-500/20 bg-slate-500/5",
    accentText: "text-slate-600 dark:text-slate-300",
  },
  {
    key: "ASSIGNED",
    label: "Prepress / Assigned",
    badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    headerBorder: "border-blue-500/20 bg-blue-500/5",
    accentText: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "IN_PROGRESS",
    label: "In Printing",
    badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    headerBorder: "border-amber-500/20 bg-amber-500/5",
    accentText: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "QUALITY_CHECK",
    label: "Quality Check",
    badgeBg: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    headerBorder: "border-purple-500/20 bg-purple-500/5",
    accentText: "text-purple-600 dark:text-purple-400",
  },
  {
    key: "COMPLETED",
    label: "Completed (Ready)",
    badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    headerBorder: "border-emerald-500/20 bg-emerald-500/5",
    accentText: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "ON_HOLD",
    label: "On Hold",
    badgeBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    headerBorder: "border-rose-500/20 bg-rose-500/5",
    accentText: "text-rose-600 dark:text-rose-400",
  },
];

const PIPELINE: ProductionStatus[] = ["PENDING", "ASSIGNED", "IN_PROGRESS", "QUALITY_CHECK", "COMPLETED"];

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
    <div className="w-full">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((stage) => {
          const stageJobs = initialJobs.filter((j) => j.status === stage.key);
          const pipelineIdx = PIPELINE.indexOf(stage.key);

          return (
            <div
              key={stage.key}
              className="flex flex-col rounded-xl border bg-card/60 p-2.5 backdrop-blur-sm transition-all"
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between gap-1.5 rounded-lg border p-2.5 font-medium text-xs ${stage.headerBorder}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`h-2 w-2 rounded-full ${stage.badgeBg.split(" ")[0]}`} />
                  <span className={`truncate font-semibold ${stage.accentText}`}>{stage.label}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${stage.badgeBg}`}>
                  {stageJobs.length}
                </span>
              </div>

              {/* Column Content */}
              <div className="mt-3 flex flex-1 flex-col gap-2.5">
                {stageJobs.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground italic">
                    <Layers className="size-4 opacity-30 mb-1" />
                    <span>No jobs</span>
                  </div>
                ) : (
                  stageJobs.map((job) => (
                    <Card
                      key={job.id}
                      className="group p-3 space-y-2.5 text-xs bg-card hover:border-primary/50 shadow-xs transition-all"
                    >
                      {/* Top Bar: Job # and Order # */}
                      <div className="flex items-center justify-between gap-1">
                        <Link
                          href={`/production/${job.id}`}
                          className="font-bold text-primary hover:underline truncate"
                        >
                          {job.number}
                        </Link>
                        <span className="shrink-0 text-[11px] font-mono text-muted-foreground">
                          {job.order?.number}
                        </span>
                      </div>

                      {/* Item Details */}
                      <div>
                        <p className="font-semibold text-foreground leading-snug line-clamp-2">
                          {job.itemName}{" "}
                          <span className="text-muted-foreground font-normal">× {job.quantity}</span>
                        </p>
                        {job.order?.customer?.name && (
                          <p className="mt-1 text-[11px] text-muted-foreground truncate">
                            Customer: <span className="text-foreground/80 font-medium">{job.order.customer.name}</span>
                          </p>
                        )}
                      </div>

                      {/* Assignee & Due Date */}
                      <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3 shrink-0" />
                          <span className="truncate">{job.assignedTo ? job.assignedTo.name : "Unassigned"}</span>
                        </div>
                        {job.expectedCompletionDate && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3 shrink-0" />
                            <span>Due {format(new Date(job.expectedCompletionDate), "d MMM")}</span>
                          </div>
                        )}
                      </div>

                      {/* Stage Selector & Actions */}
                      <div className="pt-2 border-t space-y-2">
                        <Select
                          value={job.status}
                          onValueChange={(v) => handleMoveStage(job.id, v as ProductionStatus)}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.map((s) => (
                              <SelectItem key={s.key} value={s.key} className="text-xs">
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {pipelineIdx >= 0 && (
                          <div className="flex items-center justify-between text-[11px] pt-0.5">
                            {pipelineIdx > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleMoveStage(job.id, PIPELINE[pipelineIdx - 1])}
                                className="flex items-center gap-0.5 font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                              >
                                <ChevronLeft className="size-3.5" /> Prev
                              </button>
                            ) : (
                              <span />
                            )}
                            {pipelineIdx < PIPELINE.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveStage(job.id, PIPELINE[pipelineIdx + 1])}
                                className="flex items-center gap-0.5 font-semibold text-primary hover:underline ml-auto cursor-pointer"
                              >
                                Next <ChevronRight className="size-3.5" />
                              </button>
                            )}
                          </div>
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
    </div>
  );
}
