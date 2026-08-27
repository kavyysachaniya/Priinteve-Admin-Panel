import Link from "next/link";
import { Plus, Package, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TablePagination } from "@/components/shared/table-pagination";
import { RowActions } from "@/components/shared/row-actions";
import { ProductStatusBadge } from "@/components/shared/status-badge";
import { DeleteProductItem } from "@/components/products/delete-product-item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { listProducts } from "@/lib/services/products";
import { formatCurrency } from "@/lib/money";
import type { ProductStatus, ProductType } from "@prisma/client";

export const metadata = { title: "Products & Services" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? (sp.status as ProductStatus) : undefined;
  const type = typeof sp.type === "string" ? (sp.type as ProductType) : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;

  const { products, total, pageSize } = await listProducts({ q, status, type, page });
  const isFiltered = Boolean(q || status || type);

  return (
    <div>
      <PageHeader
        title="Products & Services"
        description="What Priinteve sells — printing, design, and digital offerings."
        actions={
          <Button asChild>
            <Link href="/products/new">
              <Plus className="size-4" /> Add Product
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <TableToolbar placeholder="Search by name, SKU, description…">
            <TableFilterSelect
              paramName="type"
              placeholder="All types"
              options={[
                { value: "PRODUCT", label: "Product" },
                { value: "SERVICE", label: "Service" },
              ]}
            />
            <TableFilterSelect
              paramName="status"
              placeholder="All statuses"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
          </TableToolbar>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title={isFiltered ? "No products match your filters" : "No products yet"}
            description={
              isFiltered
                ? "Try a different search term or clear filters."
                : "Add products and services to use them in quotations and invoices."
            }
            action={
              !isFiltered && (
                <Button asChild size="sm">
                  <Link href="/products/new">
                    <Plus className="size-4" /> Add Product
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <p className="font-medium">{product.name}</p>
                      {product.sku && <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {product.type === "PRODUCT" ? "Product" : "Service"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{product.category?.name ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(product.sellingPricePaise)} <span className="text-xs text-muted-foreground">/ {product.unit}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{product.gstRate}%</TableCell>
                    <TableCell>
                      <ProductStatusBadge status={product.status} />
                    </TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem asChild>
                          <Link href={`/products/${product.id}/edit`}>
                            <Pencil className="size-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DeleteProductItem productId={product.id} productName={product.name} />
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <TablePagination page={page} pageSize={pageSize} total={total} />
      </div>
    </div>
  );
}
