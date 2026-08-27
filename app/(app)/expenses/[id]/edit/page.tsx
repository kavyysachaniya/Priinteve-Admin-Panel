import { notFound } from "next/navigation";
import { getExpenseDetail, expenseToFormValues, listExpenseCategories } from "@/lib/services/expenses";
import { listAllActiveVendors } from "@/lib/services/vendors";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Edit Expense — Priinteve Business OS" };

export default async function EditExpensePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [expense, categories, vendors] = await Promise.all([
    getExpenseDetail(id),
    listExpenseCategories(),
    listAllActiveVendors(),
  ]);

  if (!expense) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit Expense — ${expense.number}`} backHref={`/expenses/${expense.id}`} />
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <ExpenseForm
          expenseId={expense.id}
          defaultValues={expenseToFormValues(expense)}
          categories={categories}
          vendors={vendors}
        />
      </div>
    </div>
  );
}

