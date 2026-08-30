import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/accounting/account-form";

export const metadata = { title: "New Account — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  try {
    await requirePermission("accounting:manage");
  } catch {
    redirect("/accounts");
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <PageHeader title="Create Account" description="Add a new custom account to the Chart of Accounts." backHref="/accounts" />
      <div className="rounded-lg border bg-card p-6">
        <AccountForm />
      </div>
    </div>
  );
}
