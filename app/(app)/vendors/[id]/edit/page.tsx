import { notFound } from "next/navigation";
import { getVendorDetail, vendorToFormValues } from "@/lib/services/vendors";
import { VendorForm } from "@/components/vendors/vendor-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Edit Vendor — Priinteve Business OS" };

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = await getVendorDetail(id);
  if (!vendor) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={`Edit Vendor: ${vendor.businessName}`} description="Update supplier contact information and tax details." />
      <VendorForm vendorId={vendor.id} defaultValues={vendorToFormValues(vendor)} />
    </div>
  );
}

