"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Receipt } from "lucide-react";
import { ExpenseStatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/money";

export function ExpenseList({ expenses }: { expenses: any[] }) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground italic">
        No recorded expenses found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Expense #</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
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
              <TableCell className="text-xs font-medium">{exp.category.name}</TableCell>
              <TableCell className="text-xs font-medium">{exp.description}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

