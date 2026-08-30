import { PageHeader } from "@/components/shared/page-header";
import { listAccountingPeriods } from "@/lib/services/accounting/periods";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { PeriodToggle } from "@/components/accounting/period-toggle";
import { PeriodForm } from "@/components/accounting/period-form";

export const metadata = { title: "Accounting Periods — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function AccountingPeriodsPage() {
  try {
    await requirePermission("accounting:manage");
  } catch {
    redirect("/dashboard");
  }

  const periods = await listAccountingPeriods();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* List Periods */}
      <div className="md:col-span-2 space-y-4">
        <PageHeader
          title="Accounting Periods"
          description="Maintain separate financial years and control transaction boundary posting rules."
        />

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="w-[120px] text-center">Status</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground italic">
                    No periods configured. Postings are completely open.
                  </TableCell>
                </TableRow>
              ) : (
                periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="text-xs font-semibold">{period.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(period.startDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(period.endDate)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        period.status === "OPEN"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {period.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <PeriodToggle id={period.id} isOpen={period.status === "OPEN"} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Period */}
      <div className="space-y-4 pt-10">
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">New Accounting Period</h3>
          <PeriodForm />
        </div>
      </div>
    </div>
  );
}
