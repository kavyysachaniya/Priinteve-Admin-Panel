"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Receipt, Edit, Trash2 } from "lucide-react";
import { ExpenseStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/money";
import { deleteExpenseAction } from "@/lib/actions/expenses";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ExpenseDetail({ expense }: { expense: any }) {
  const router = useRouter();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Expense {expense.number}</h1>
            <ExpenseStatusBadge status={expense.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Recorded on {format(new Date(expense.date), "PPP")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/expenses/${expense.id}/edit`}>
              <Edit className="size-3.5 mr-1" /> Edit
            </Link>
          </Button>

          <ConfirmDialog
            title="Delete Expense"
            description="Are you sure you want to delete this expense record?"
            onConfirm={async () => {
              const res = await deleteExpenseAction(expense.id);
              if (res.success) router.push("/expenses");
              return res;
            }}
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-3.5" />
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Expense Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Category:</span>{" "}
              <span className="font-semibold text-foreground">{expense.category.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Description:</span>{" "}
              <span className="font-semibold text-foreground">{expense.description}</span>
            </div>
            {expense.vendor && (
              <div>
                <span className="text-muted-foreground">Vendor:</span>{" "}
                <Link href={`/vendors/${expense.vendor.id}`} className="font-semibold text-primary hover:underline">
                  {expense.vendor.businessName}
                </Link>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Payment Method:</span>{" "}
              <span className="font-semibold text-foreground">{expense.paymentMethod}</span>
            </div>
            {expense.referenceNumber && (
              <div>
                <span className="text-muted-foreground">Reference / UTR #:</span>{" "}
                <span className="font-mono font-bold text-foreground">{expense.referenceNumber}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Financial Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base Amount:</span>
              <span className="font-semibold">{formatCurrency(expense.baseAmountPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST ({expense.gstRate}%):</span>
              <span className="font-semibold">{formatCurrency(expense.gstAmountPaise)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-sm font-bold">
              <span>Total Amount:</span>
              <span className="text-rose-600 dark:text-rose-400">{formatCurrency(expense.totalAmountPaise)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

