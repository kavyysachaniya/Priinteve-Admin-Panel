import Link from "next/link";
import { IndianRupee, TrendingUp, Wallet, Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { MonthlyRevenueChart } from "@/components/finance/monthly-revenue-chart";
import { InvoiceSummaryBreakdown } from "@/components/finance/invoice-summary-breakdown";
import { ExpenseBreakdownChart } from "@/components/finance/expense-breakdown-chart";
import { FinancialActivityList } from "@/components/finance/financial-activity-list";
import { TopCustomers } from "@/components/finance/top-customers";
import {
  getFinanceOverview,
  getMonthlyRevenueThisYear,
  getTopCustomers,
  getRecentFinancialActivity,
} from "@/lib/services/finance";
import { formatCurrency } from "@/lib/money";

export const metadata = { title: "Finance Overview — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [overview, monthly, topCustomers, financialActivity] = await Promise.all([
    getFinanceOverview(),
    getMonthlyRevenueThisYear(),
    getTopCustomers(5),
    getRecentFinancialActivity(10),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Overview"
        description="Comprehensive financial performance insights, cash revenue, recorded operational expenses, net profit, and receivables."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(overview.revenuePaise)}
          changeLabel="Total cash receipts"
          changeDirection="neutral"
          icon={IndianRupee}
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(overview.expensesPaise)}
          changeLabel="Recorded valid expenses"
          changeDirection="neutral"
          icon={Receipt}
        />
        <StatCard
          label="Net Position"
          value={formatCurrency(overview.netProfitPaise)}
          changeLabel="Revenue minus expenses"
          changeDirection={overview.netProfitPaise >= 0 ? "up" : "down"}
          icon={TrendingUp}
        />
        <StatCard
          label="Outstanding Receivables"
          value={formatCurrency(overview.receivablesPaise)}
          changeLabel="Across unpaid invoices"
          changeDirection="neutral"
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Monthly Revenue Trend — {new Date().getFullYear()}</h3>
          <MonthlyRevenueChart data={monthly} />
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Expenses by Category</h3>
          <ExpenseBreakdownChart categories={overview.expensesByCategory} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Top Customers</h3>
          <TopCustomers customers={topCustomers} />
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Recent Financial Activity (Inflow & Outflow)</h3>
          <FinancialActivityList items={financialActivity} />
        </div>
      </div>
    </div>
  );
}
