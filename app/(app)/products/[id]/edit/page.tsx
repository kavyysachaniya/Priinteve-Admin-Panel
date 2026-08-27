export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "@/components/products/product-form";
import { getProductById, listCategoryNames, productToFormValues } from "@/lib/services/products";

export const metadata = { title: "Edit Product" };

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  const { id } = await params;
  const [product, categorySuggestions] = await Promise.all([getProductById(id), listCategoryNames()]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Edit ${product.name}`} backHref="/products" />
      <ProductForm productId={product.id} defaultValues={productToFormValues(product)} categorySuggestions={categorySuggestions} />
    </div>
  );
}
