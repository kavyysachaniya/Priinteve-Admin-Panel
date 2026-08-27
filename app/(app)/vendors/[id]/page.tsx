export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getVendorDetail } from "@/lib/services/vendors";
import { VendorDetail } from "@/components/vendors/vendor-detail";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Vendor Details — Priinteve Business OS" };

export default async function VendorDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const vendor = await getVendorDetail(id);

  if (!vendor) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor Overview" backHref="/vendors" />
      <VendorDetail vendor={vendor} />
    </div>
  );
}

