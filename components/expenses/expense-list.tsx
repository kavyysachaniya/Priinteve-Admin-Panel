"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Receipt, Eye, Pencil } from "lucide-react";
import { ExpenseStatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { QuickAction, RowActionsBar } from "@/components/shared/row-actions";
import { DeleteExpenseItem } from "@/components/expenses/delete-expense-item";
import { formatCurrency } from "@/lib/money";

export function ExpenseList({ expenses }: { expenses: any[] }) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No recorded expenses"
        description="Record operational spending, vendor payouts, and their GST breakdown."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Expense #</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead className="hidden lg:table-cell">Description</TableHead>
            <TableHead className="hidden lg:table-cell">Vendor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((exp) => (
            <TableRow key={exp.id}>
              <TableCell className="text-xs">{format(new Date(exp.date), "d MMM yyyy")}</TableCell>
              <TableCell className="font-semibold text-xs">
                <Link href={`/expenses/${exp.id}`} className="text-primary hover:underline flex items-center gap-1.5">
                  <Receipt className="size-3.5" /> {exp.number}
                </Link>
              </TableCell>
              <TableCell className="hidden text-xs font-medium md:table-cell">{exp.category.name}</TableCell>
              <TableCell className="hidden text-xs font-medium lg:table-cell">{exp.description}</TableCell>
              <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                {exp.vendor ? (
                  <Link href={`/vendors/${exp.vendor.id}`} className="hover:underline text-foreground">
                    {exp.vendor.businessName}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <ExpenseStatusBadge status={exp.status} />
              </TableCell>
              <TableCell className="text-right text-sm font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(exp.totalAmountPaise)}
              </TableCell>
              <TableCell>
                <RowActionsBar>
                  <QuickAction icon={Eye} label="View" href={`/expenses/${exp.id}`} />
                  <QuickAction icon={Pencil} label="Edit" href={`/expenses/${exp.id}/edit`} />
                  <DeleteExpenseItem expenseId={exp.id} expenseNumber={exp.number} />
                </RowActionsBar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
