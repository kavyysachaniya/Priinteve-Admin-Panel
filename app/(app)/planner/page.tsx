export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/page-header";
import { PlannerWorkspace } from "@/components/planner/planner-workspace";
import { getPlannerDataForDate } from "@/lib/services/calendar";

export const metadata = { title: "Daily Planner — Priinteve Business OS" };

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const targetDate = params.date ? new Date(params.date) : new Date();
  const data = await getPlannerDataForDate(targetDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Planner & Command Center"
        description="Unified daily agenda combining production jobs, deliveries, tasks, and notes."
      />
      <PlannerWorkspace initialDate={targetDate.toISOString()} data={data} />
    </div>
  );
}

