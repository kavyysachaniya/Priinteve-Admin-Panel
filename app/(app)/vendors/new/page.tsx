import { PageHeader } from "@/components/shared/page-header";
import { VendorForm } from "@/components/vendors/vendor-form";

export const metadata = { title: "New Vendor — Priinteve Business OS" };

export default async function NewVendorPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Add Supplier / Vendor" backHref="/vendors" />
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <VendorForm />
      </div>
    </div>
  );
}

