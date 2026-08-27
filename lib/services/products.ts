import { prisma } from "@/lib/prisma";
import { rupeesToPaise, paiseToRupees } from "@/lib/money";
import type { ProductFormValues } from "@/lib/validations/product";
import type { Prisma, ProductStatus, ProductType } from "@prisma/client";

const PAGE_SIZE = 10;

export interface ListProductsParams {
  q?: string;
  type?: ProductType;
  status?: ProductStatus;
  page?: number;
}

export async function listProducts(params: ListProductsParams) {
  const page = Math.max(1, params.page ?? 1);
  const where: Prisma.ProductWhereInput = {
    ...(params.type ? { type: params.type } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q } },
            { sku: { contains: params.q } },
            { description: { contains: params.q } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: true },
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total, page, pageSize: PAGE_SIZE };
}

export async function listAllActiveProducts() {
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: { category: true },
  });
}

export async function listCategoryNames() {
  const categories = await prisma.productCategory.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  return categories.map((c) => c.name);
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({ where: { id }, include: { category: true } });
}

async function resolveCategoryId(categoryName: string | undefined): Promise<string | null> {
  const name = categoryName?.trim();
  if (!name) return null;
  const category = await prisma.productCategory.upsert({
    where: { name },
    update: {},
    create: { name },
  });
  return category.id;
}

export async function createProduct(data: ProductFormValues) {
  const categoryId = await resolveCategoryId(data.categoryName);
  return prisma.product.create({
    data: {
      name: data.name,
      type: data.type,
      categoryId,
      description: data.description || null,
      sku: data.sku || null,
      unit: data.unit,
      sellingPricePaise: rupeesToPaise(data.sellingPrice),
      costPricePaise: data.costPrice !== undefined ? rupeesToPaise(data.costPrice) : null,
      gstRate: data.gstRate,
      status: data.status,
    },
  });
}

export async function updateProduct(id: string, data: ProductFormValues) {
  const categoryId = await resolveCategoryId(data.categoryName);
  return prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      categoryId,
      description: data.description || null,
      sku: data.sku || null,
      unit: data.unit,
      sellingPricePaise: rupeesToPaise(data.sellingPrice),
      costPricePaise: data.costPrice !== undefined ? rupeesToPaise(data.costPrice) : null,
      gstRate: data.gstRate,
      status: data.status,
    },
  });
}

export async function canDeleteProduct(id: string) {
  const [quotationItems, invoiceItems] = await Promise.all([
    prisma.quotationItem.count({ where: { productId: id } }),
    prisma.invoiceItem.count({ where: { productId: id } }),
  ]);
  return quotationItems === 0 && invoiceItems === 0;
}

export async function deleteProduct(id: string) {
  const allowed = await canDeleteProduct(id);
  if (!allowed) {
    throw new Error(
      "This product is used in existing quotations or invoices. Mark it Inactive instead of deleting."
    );
  }
  await prisma.product.delete({ where: { id } });
}

export function productToFormValues(
  product: NonNullable<Awaited<ReturnType<typeof getProductById>>>
): ProductFormValues {
  return {
    name: product.name,
    type: product.type,
    categoryName: product.category?.name ?? "",
    description: product.description ?? "",
    sku: product.sku ?? "",
    unit: product.unit,
    sellingPrice: paiseToRupees(product.sellingPricePaise),
    costPrice: product.costPricePaise != null ? paiseToRupees(product.costPricePaise) : undefined,
    gstRate: product.gstRate,
    status: product.status,
  };
}
