export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { listExpenseCategories } from "@/lib/services/expenses";
import { listAllActiveVendors } from "@/lib/services/vendors";

export const metadata = { title: "Record Expense — Priinteve Business OS" };

export default async function NewExpensePage(props: {
  searchParams: Promise<{ vendorId?: string }>;
}) {
  const searchParams = (await props.searchParams) || {};
  const vendorId = searchParams.vendorId ?? "";

  const [categories, vendors] = await Promise.all([
    listExpenseCategories(),
    listAllActiveVendors(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Record Expense" backHref="/expenses" />
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <ExpenseForm
          categories={categories}
          vendors={vendors}
          defaultValues={{ vendorId }}
        />
      </div>
    </div>
  );
}

