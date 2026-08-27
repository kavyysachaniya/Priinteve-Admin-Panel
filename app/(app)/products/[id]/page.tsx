export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";

// Products don't have a standalone detail view in Phase 1 — editing is the
// primary touchpoint, so route straight there.
export default async function ProductDetailRedirect({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  redirect(`/products/${id}/edit`);
}
