"use client";

import Link from "next/link";
import { Store } from "lucide-react";
import { VendorStatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/money";

export function VendorList({ vendors }: { vendors: any[] }) {
  if (vendors.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground italic">
        No vendors found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor / Company Name</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>GSTIN</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total Expenses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell className="font-semibold text-xs">
                <Link href={`/vendors/${vendor.id}`} className="text-primary hover:underline flex items-center gap-1.5">
                  <Store className="size-3.5" /> {vendor.businessName}
                </Link>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{vendor.contactPerson ?? "—"}</TableCell>
              <TableCell className="text-xs">{vendor.phone}</TableCell>
              <TableCell className="text-xs font-mono">{vendor.gstin ?? "—"}</TableCell>
              <TableCell>
                <VendorStatusBadge status={vendor.status} />
              </TableCell>
              <TableCell className="text-right text-xs font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(vendor.totalExpensesPaise)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

