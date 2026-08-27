import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "@/components/products/product-form";
import { listCategoryNames } from "@/lib/services/products";

export const metadata = { title: "New Product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categorySuggestions = await listCategoryNames();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add Product / Service" backHref="/products" />
      <ProductForm categorySuggestions={categorySuggestions} />
    </div>
  );
}
