export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ExpenseList } from "@/components/expenses/expense-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listExpenses, listExpenseCategories } from "@/lib/services/expenses";
import type { ExpenseStatus } from "@prisma/client";

export const metadata = { title: "Expenses — Priinteve Business OS" };

export default async function ExpensesPage(props: {
  searchParams: Promise<{ q?: string; status?: string; categoryId?: string; page?: string }>;
}) {
  const searchParams = (await props.searchParams) || {};
  const q = searchParams.q ?? "";
  const status = searchParams.status as ExpenseStatus | undefined;
  const categoryId = searchParams.categoryId ?? "";
  const page = Number(searchParams.page ?? 1);

  const [{ expenses, total, pageSize }, categories] = await Promise.all([
    listExpenses({ q, status, categoryId, page }),
    listExpenseCategories(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Tracker"
        description="Record operational spending, tax breakdown, and vendor payouts."
        actions={
          <Button asChild size="sm">
            <Link href="/expenses/new">
              <Plus className="size-4 mr-1" /> Record Expense
            </Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-4">
        <TableFilterSelect
          paramName="status"
          placeholder="Filter by Status"
          options={[
            { label: "All Statuses", value: "" },
            { label: "Recorded", value: "RECORDED" },
            { label: "Draft", value: "DRAFT" },
            { label: "Cancelled", value: "CANCELLED" },
          ]}
        />
        <TableFilterSelect
          paramName="categoryId"
          placeholder="Filter Category"
          options={[
            { label: "All Categories", value: "" },
            ...categories.map((c: { name: string; id: string }) => ({ label: c.name, value: c.id })),
          ]}
        />
      </div>
      <ExpenseList expenses={expenses} />
      <TablePagination total={total} pageSize={pageSize} page={page} />
    </div>
  );
}
