"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Factory, Eye } from "lucide-react";
import { ProductionStatusBadge, OrderPriorityBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { QuickAction, RowActionsBar } from "@/components/shared/row-actions";

export function ProductionList({
  jobs,
  total,
  pageSize,
  page,
}: {
  jobs: any[];
  total: number;
  pageSize: number;
  page: number;
}) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Factory}
        title="No production jobs found"
        description="Production jobs can be created from orders that need to be fulfilled."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job #</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead className="hidden md:table-cell">Customer</TableHead>
            <TableHead>Item Name</TableHead>
            <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
            <TableHead className="hidden md:table-cell">Priority</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="hidden lg:table-cell">Expected Due</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-semibold text-xs">
                <Link href={`/production/${job.id}`} className="text-primary hover:underline flex items-center gap-1.5">
                  <Factory className="size-3.5" /> {job.number}
                </Link>
              </TableCell>
              <TableCell className="text-xs">
                <Link href={`/orders/${job.order.id}`} className="text-primary hover:underline font-mono font-semibold">
                  {job.order.number}
                </Link>
              </TableCell>
              <TableCell className="hidden text-xs font-medium md:table-cell">{job.order.customer.name}</TableCell>
              <TableCell className="text-xs font-semibold">
                {job.itemName} <span className="text-muted-foreground font-normal">× {job.quantity}</span>
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                {job.assignedTo ? job.assignedTo.name : "Unassigned"}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <OrderPriorityBadge priority={job.priority} />
              </TableCell>
              <TableCell>
                <ProductionStatusBadge status={job.status} />
              </TableCell>
              <TableCell className="hidden text-xs lg:table-cell">
                {job.expectedCompletionDate ? format(new Date(job.expectedCompletionDate), "d MMM yyyy") : "—"}
              </TableCell>
              <TableCell>
                <RowActionsBar>
                  <QuickAction icon={<Eye className="size-3.5" />} label="View" href={`/production/${job.id}`} />
                </RowActionsBar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
