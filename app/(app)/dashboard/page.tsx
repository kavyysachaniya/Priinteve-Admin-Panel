import { IndianRupee, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { OperationalWidgets } from "@/components/dashboard/operational-widgets";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import {
  getSummaryCards,
  getRevenueExpenseSeries,
  getRecentActivity,
  getNeedsAttention,
  getRecentTransactions,
  getDashboardPhase2Data,
} from "@/lib/services/dashboard";
import { formatCurrency } from "@/lib/money";

export const metadata = { title: "Dashboard — Priinteve Business OS" };
export const dynamic = "force-dynamic";

function changeLabel(pct: number | null, suffix = "from last month") {
  if (pct === null) return `New this month`;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% ${suffix}`;
}

export default async function DashboardPage() {
  const [summary, series, activity, attention, transactions, phase2Data] = await Promise.all([
    getSummaryCards(),
    getRevenueExpenseSeries("30d"),
    getRecentActivity(8),
    getNeedsAttention(),
    getRecentTransactions(8),
    getDashboardPhase2Data(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your business operations, finances, and daily priorities at a glance." />

      {/* Financial Stat Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(summary.revenuePaise)}
          changeLabel={changeLabel(summary.revenueChange.pct)}
          changeDirection={summary.revenueChange.direction}
          icon={IndianRupee}
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(summary.expensesPaise)}
          changeLabel={changeLabel(summary.expensesChange.pct)}
          changeDirection={summary.expensesChange.direction}
          icon={TrendingDown}
        />
        <StatCard
          label="Net Profit"
          value={formatCurrency(summary.netProfitPaise)}
          changeLabel={changeLabel(summary.netProfitChange.pct)}
          changeDirection={summary.netProfitChange.direction}
          icon={TrendingUp}
        />
        <StatCard
          label="Outstanding Payments"
          value={formatCurrency(summary.outstandingPaise)}
          changeLabel="Across all unpaid invoices"
          changeDirection="neutral"
          icon={Wallet}
        />
      </div>

      {/* Phase 2 Operational Highlights */}
      <OperationalWidgets {...phase2Data} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart initialData={series} />
        </div>
        <NeedsAttention {...attention} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Recent Activity & Transactions</h3>
          <RecentTransactions transactions={transactions} />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">System Activity Timeline</h3>
          <div className="rounded-lg border bg-card p-5">
            <ActivityTimeline items={activity} />
          </div>
        </div>
      </div>
    </div>
  );
}
