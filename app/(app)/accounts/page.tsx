import Link from "next/link";
import { Plus, Calculator, Check, X, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAccounts, seedChartOfAccounts } from "@/lib/services/accounting/accounts";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Chart of Accounts — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
  try {
    await requirePermission("accounting:view");
  } catch {
    redirect("/dashboard");
  }

  let accounts = await listAccounts();
  if (accounts.length === 0) {
    await seedChartOfAccounts();
    accounts = await listAccounts();
  }

  // Group accounts by type for display
  const assets = accounts.filter((a) => a.type === "ASSET");
  const liabilities = accounts.filter((a) => a.type === "LIABILITY");
  const equity = accounts.filter((a) => a.type === "EQUITY");
  const income = accounts.filter((a) => a.type === "INCOME");
  const expenses = accounts.filter((a) => a.type === "EXPENSE");

  const groups = [
    { title: "Assets", items: assets },
    { title: "Liabilities", items: liabilities },
    { title: "Equity", items: equity },
    { title: "Income", items: income },
    { title: "Expenses", items: expenses },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Core financial structure of Priinteve. Real-time balances derived from transaction ledger entries."
        actions={
          <Button asChild size="sm">
            <Link href="/accounts/new">
              <Plus className="size-4 mr-1" /> New Account
            </Link>
          </Button>
        }
      />

      <div className="space-y-8">
        {groups.map((group) => {
          if (group.items.length === 0) return null;
          const totalBalance = group.items.reduce((sum, item) => sum + item.balancePaise, 0);

          return (
            <div key={group.title} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calculator className="size-4 text-muted-foreground" />
                  {group.title} ({group.items.length} accounts)
                </h3>
                <span className="text-sm font-bold text-foreground">
                  Total: {formatCurrency(totalBalance)}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debits</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right font-semibold">Current Balance</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-mono text-xs font-semibold">{acc.code}</TableCell>
                      <TableCell className="text-xs">
                        <Link href={`/accounting/ledger?accountId=${acc.id}`} className="font-medium text-primary hover:underline">
                          {acc.name}
                        </Link>
                        {acc.isSystem && (
                          <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-750/10 dark:bg-blue-400/10 dark:text-blue-400">
                            System
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.type}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {acc.debitPaise > 0 ? formatCurrency(acc.debitPaise) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {acc.creditPaise > 0 ? formatCurrency(acc.creditPaise) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold text-foreground">
                        {formatCurrency(acc.balancePaise)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold leading-none ${
                          acc.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {acc.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
