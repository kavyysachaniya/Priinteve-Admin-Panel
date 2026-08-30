import { PageHeader } from "@/components/shared/page-header";
import { getCashBankAccounts } from "@/lib/services/accounting/accounts";
import { formatCurrency } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";

export const metadata = { title: "Cash & Bank — Priinteve Business OS" };
export const dynamic = "force-dynamic";

export default async function CashBankPage() {
  try {
    await requirePermission("accounting:view");
  } catch {
    redirect("/dashboard");
  }

  const cashBankAccounts = await getCashBankAccounts();

  // Aggregate stats
  const totalOpening = cashBankAccounts.reduce((sum, a) => sum + a.openingBalancePaise, 0);
  const totalInflow = cashBankAccounts.reduce((sum, a) => sum + a.totalInflowPaise, 0);
  const totalOutflow = cashBankAccounts.reduce((sum, a) => sum + a.totalOutflowPaise, 0);
  const totalBalance = cashBankAccounts.reduce((sum, a) => sum + a.currentBalancePaise, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash & Bank Accounts"
        description="Monitor liquidity, bank statements, cash in hand and UPI account balances."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Wallet className="size-3.5 text-muted-foreground" />
            Opening Balance (Total)
          </p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(totalOpening)}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ArrowUpRight className="size-3.5 text-emerald-500" />
            Total Inflows
          </p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(totalInflow)}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ArrowDownRight className="size-3.5 text-red-500" />
            Total Outflows
          </p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(totalOutflow)}</p>
        </Card>
        <Card className="p-4 space-y-1 border-primary/20 bg-primary/5">
          <p className="text-xs text-primary/80 flex items-center gap-1.5">
            <Landmark className="size-3.5 text-primary" />
            Current Cash Position
          </p>
          <p className="text-lg font-bold text-primary">{formatCurrency(totalBalance)}</p>
        </Card>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-4 bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground" />
            Financial Accounts
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right">Opening Balance</TableHead>
              <TableHead className="text-right text-emerald-600">Total Inflows</TableHead>
              <TableHead className="text-right text-red-600">Total Outflows</TableHead>
              <TableHead className="text-right font-bold text-foreground">Current Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashBankAccounts.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell className="font-mono text-xs font-semibold">{acc.code}</TableCell>
                <TableCell className="text-xs font-medium">
                  <a href={`/accounting/ledger?accountId=${acc.id}`} className="text-primary hover:underline">
                    {acc.name}
                  </a>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {formatCurrency(acc.openingBalancePaise)}
                </TableCell>
                <TableCell className="text-right text-xs text-emerald-600 font-medium">
                  {acc.totalInflowPaise > 0 ? `+${formatCurrency(acc.totalInflowPaise)}` : "—"}
                </TableCell>
                <TableCell className="text-right text-xs text-red-600 font-medium">
                  {acc.totalOutflowPaise > 0 ? `-${formatCurrency(acc.totalOutflowPaise)}` : "—"}
                </TableCell>
                <TableCell className="text-right text-xs font-bold text-foreground">
                  {formatCurrency(acc.currentBalancePaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
