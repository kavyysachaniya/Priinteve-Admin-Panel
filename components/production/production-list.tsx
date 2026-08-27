"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Factory } from "lucide-react";
import { ProductionStatusBadge, OrderPriorityBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground italic">
        No production jobs found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job #</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Item Name</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Expected Due</TableHead>
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
              <TableCell className="text-xs font-medium">{job.order.customer.name}</TableCell>
              <TableCell className="text-xs font-semibold">{job.itemName}</TableCell>
              <TableCell>
                <OrderPriorityBadge priority={job.priority} />
              </TableCell>
              <TableCell>
                <ProductionStatusBadge status={job.status} />
              </TableCell>
              <TableCell className="text-xs">
                {job.expectedCompletionDate ? format(new Date(job.expectedCompletionDate), "d MMM yyyy") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

