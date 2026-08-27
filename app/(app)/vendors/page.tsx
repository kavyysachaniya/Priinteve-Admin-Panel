export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { VendorList } from "@/components/vendors/vendor-list";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { listVendors } from "@/lib/services/vendors";
import type { VendorStatus } from "@prisma/client";

export const metadata = { title: "Vendors — Priinteve Business OS" };

export default async function VendorsPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const searchParams = (await props.searchParams) || {};
  const q = searchParams.q ?? "";
  const status = searchParams.status as VendorStatus | undefined;
  const page = Number(searchParams.page ?? 1);

  const { vendors, total, pageSize } = await listVendors({ q, status, page });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors & Suppliers"
        description="Supplier directory, paper & material vendors, contact records, and payout totals."
        actions={
          <Button asChild size="sm">
            <Link href="/vendors/new">
              <Plus className="size-4 mr-1" /> Add Vendor
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <TableFilterSelect
          paramName="status"
          placeholder="Filter Status"
          options={[
            { label: "All Statuses", value: "" },
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
        />
      </div>
      <VendorList vendors={vendors} />
      <TablePagination total={total} pageSize={pageSize} page={page} />
    </div>
  );
}

