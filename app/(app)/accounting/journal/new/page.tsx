import { PageHeader } from "@/components/shared/page-header";
import { listAccounts } from "@/lib/services/accounting/accounts";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { JournalForm } from "@/components/accounting/journal-form";

export const metadata = { title: "New Manual Journal — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function NewJournalPage() {
  try {
    await requirePermission("journal:create");
  } catch {
    redirect("/accounting/journal");
  }

  const accounts = await listAccounts({ activeOnly: true });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="New Manual Journal Entry"
        description="Create a manual balanced double-entry accounting adjustment."
        backHref="/accounting/journal"
      />
      <div className="rounded-lg border bg-card p-6">
        <JournalForm accounts={accounts} />
      </div>
    </div>
  );
}
