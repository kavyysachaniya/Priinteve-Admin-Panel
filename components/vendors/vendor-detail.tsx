"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Store, Phone, Mail, MapPin, Edit, Trash2, Plus } from "lucide-react";
import { VendorStatusBadge, ExpenseStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { formatCurrency } from "@/lib/money";
import { deleteVendorAction } from "@/lib/actions/vendors";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function VendorDetail({ vendor }: { vendor: any }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{vendor.businessName}</h1>
            <VendorStatusBadge status={vendor.status} />
          </div>
          {vendor.contactPerson && (
            <p className="text-xs text-muted-foreground mt-1">Contact: {vendor.contactPerson}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="default">
            <Link href={`/expenses/new?vendorId=${vendor.id}`}>
              <Plus className="size-4 mr-1" /> Record Expense
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link href={`/vendors/${vendor.id}/edit`}>
              <Edit className="size-3.5 mr-1" /> Edit
            </Link>
          </Button>

          <ConfirmDialog
            title="Delete Vendor"
            description="Are you sure you want to delete this vendor?"
            onConfirm={async () => {
              const res = await deleteVendorAction(vendor.id);
              if (res.success) router.push("/vendors");
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

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total Expenses Recorded</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(vendor.totalExpensesPaise)}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total Transactions</p>
          <p className="text-lg font-bold text-foreground">{vendor.transactionCount}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Latest Expense</p>
          <p className="text-sm font-semibold">
            {vendor.latestExpense ? (
              <span>{formatCurrency(vendor.latestExpense.totalAmountPaise)} ({format(new Date(vendor.latestExpense.date), "d MMM yyyy")})</span>
            ) : (
              <span className="text-muted-foreground italic">No expenses yet</span>
            )}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({vendor.expenses.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity History</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Business & Tax Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-semibold text-foreground mt-0.5">{vendor.phone}</p>
                </div>
                {vendor.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-semibold text-foreground mt-0.5">{vendor.email}</p>
                  </div>
                )}
                {vendor.gstin && (
                  <div>
                    <span className="text-muted-foreground">GSTIN:</span>
                    <p className="font-mono font-bold text-foreground mt-0.5">{vendor.gstin}</p>
                  </div>
                )}
                {vendor.address && (
                  <div>
                    <span className="text-muted-foreground">Address:</span>
                    <p className="font-medium text-foreground mt-0.5">{vendor.address}, {vendor.city} {vendor.state} {vendor.pincode}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Expense #</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendor.expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground italic">
                        No expenses recorded for this vendor yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendor.expenses.map((exp: any) => (
                      <TableRow key={exp.id}>
                        <TableCell className="text-xs">{format(new Date(exp.date), "d MMM yyyy")}</TableCell>
                        <TableCell className="font-semibold text-xs">
                          <Link href={`/expenses/${exp.id}`} className="text-primary hover:underline">
                            {exp.number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{exp.category.name}</TableCell>
                        <TableCell className="text-xs font-medium">{exp.description}</TableCell>
                        <TableCell>
                          <ExpenseStatusBadge status={exp.status} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {formatCurrency(exp.totalAmountPaise)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={vendor.activityLogs ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Vendor Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              {vendor.notes ? (
                <p className="whitespace-pre-wrap leading-relaxed text-foreground">{vendor.notes}</p>
              ) : (
                <p className="text-muted-foreground italic">No notes added for this vendor.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

