import { notFound } from "next/navigation";
import { getExpenseDetail } from "@/lib/services/expenses";
import { ExpenseDetail } from "@/components/expenses/expense-detail";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Expense Details — Priinteve Business OS" };

export default async function ExpenseDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const expense = await getExpenseDetail(id);

  if (!expense) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Expense ${expense.number}`} backHref="/expenses" />
      <ExpenseDetail expense={expense} />
    </div>
  );
}

