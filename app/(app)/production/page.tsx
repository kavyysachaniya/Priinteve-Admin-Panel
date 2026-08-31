export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { Button } from "@/components/ui/button";
import { ProductionKanban } from "@/components/production/production-kanban";
import { ProductionList } from "@/components/production/production-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listProductionJobs, getProductionStageCounts } from "@/lib/services/production";
import { listUsers } from "@/lib/services/users";
import type { ProductionStatus, OrderPriority } from "@prisma/client";

export const metadata = { title: "Production Management — Priinteve Business OS" };

const STAGE_LABELS: Record<ProductionStatus, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  QUALITY_CHECK: "Quality Check",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; priority?: string; assignedToId?: string; view?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const viewMode = params.view ?? "kanban";

  const [data, stageCounts, users] = await Promise.all([
    listProductionJobs({
      q: params.q,
      stage: params.stage as ProductionStatus,
      priority: params.priority as OrderPriority,
      assignedToId: params.assignedToId,
      page,
    }),
    getProductionStageCounts(),
    listUsers(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production & Shopfloor Management"
        description="Track job stages, prepress, printing, quality checks, and completion."
        actions={
          <Button asChild size="sm">
            <Link href="/production/new">
              <Plus className="size-4" /> New Production Job
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(STAGE_LABELS) as ProductionStatus[]).map((stage) => (
          <Link key={stage} href={`/production?stage=${stage}`}>
            <StatCard label={STAGE_LABELS[stage]} value={String(stageCounts[stage])} />
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TableToolbar placeholder="Search by job #, order #, item…">
          <TableFilterSelect
            paramName="stage"
            placeholder="All Stages"
            options={(Object.keys(STAGE_LABELS) as ProductionStatus[]).map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          />
          <TableFilterSelect
            paramName="priority"
            placeholder="All Priorities"
            options={[
              { value: "LOW", label: "Low" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HIGH", label: "High" },
              { value: "URGENT", label: "Urgent" },
            ]}
          />
          <TableFilterSelect
            paramName="assignedToId"
            placeholder="All Employees"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        </TableToolbar>
      </div>

      {viewMode === "list" ? (
        <>
          <ProductionList jobs={data.jobs} total={data.total} page={data.page} pageSize={data.pageSize} />
          <TablePagination total={data.total} page={data.page} pageSize={data.pageSize} />
        </>
      ) : (
        <ProductionKanban initialJobs={data.jobs} />
      )}
    </div>
  );
}
