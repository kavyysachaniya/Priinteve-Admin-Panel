"use client";

import Link from "next/link";
import { Store, Eye, Pencil } from "lucide-react";
import { VendorStatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { QuickAction, RowActions, RowActionsBar } from "@/components/shared/row-actions";
import { DeleteVendorItem } from "@/components/vendors/delete-vendor-item";
import { formatCurrency } from "@/lib/money";
import type { VendorListItem } from "@/lib/services/vendors";

export function VendorList({ vendors }: { vendors: VendorListItem[] }) {
  if (vendors.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title="No vendors found"
        description="Add suppliers and material vendors to track expenses against them."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor / Company Name</TableHead>
            <TableHead className="hidden md:table-cell">Contact Person</TableHead>
            <TableHead className="hidden md:table-cell">Phone</TableHead>
            <TableHead className="hidden lg:table-cell">GSTIN</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total Expenses</TableHead>
            <TableHead className="w-10" />
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
              <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{vendor.contactPerson ?? "—"}</TableCell>
              <TableCell className="hidden text-xs md:table-cell">{vendor.phone}</TableCell>
              <TableCell className="hidden text-xs font-mono lg:table-cell">{vendor.gstin ?? "—"}</TableCell>
              <TableCell>
                <VendorStatusBadge status={vendor.status} />
              </TableCell>
              <TableCell className="text-right text-xs font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(vendor.totalExpensesPaise)}
              </TableCell>
              <TableCell>
                <RowActionsBar>
                  <QuickAction icon={Eye} label="View" href={`/vendors/${vendor.id}`} />
                  <QuickAction icon={Pencil} label="Edit" href={`/vendors/${vendor.id}/edit`} />
                  <RowActions>
                    <DeleteVendorItem vendorId={vendor.id} vendorName={vendor.businessName} />
                  </RowActions>
                </RowActionsBar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
