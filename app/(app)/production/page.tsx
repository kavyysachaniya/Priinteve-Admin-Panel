export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/page-header";
import { ProductionKanban } from "@/components/production/production-kanban";
import { ProductionList } from "@/components/production/production-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listProductionJobs } from "@/lib/services/production";
import type { ProductionStatus } from "@prisma/client";

export const metadata = { title: "Production Management — Priinteve Business OS" };

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; view?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const viewMode = params.view ?? "kanban";
  const data = await listProductionJobs({ q: params.q, stage: params.stage as ProductionStatus, page });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production & Shopfloor Management"
        description="Track job stages, prepress, printing, quality checks, and completion."
      />

      <div className="flex items-center justify-between gap-4">
        <TableFilterSelect
          paramName="stage"
          placeholder="All Production Stages"
          options={[
            { label: "Pending", value: "PENDING" },
            { label: "Assigned", value: "ASSIGNED" },
            { label: "In Progress", value: "IN_PROGRESS" },
            { label: "Quality Check", value: "QUALITY_CHECK" },
            { label: "Completed", value: "COMPLETED" },
          ]}
        />
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
