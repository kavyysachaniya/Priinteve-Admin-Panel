import { DocumentHeader } from "@/components/documents/document-header";
import { CompanyDetails } from "@/components/documents/company-details";
import { CustomerDetails } from "@/components/documents/customer-details";
import { DocumentItemsTable } from "@/components/documents/document-items-table";
import { DocumentTotals } from "@/components/documents/document-totals";
import { TermsSection } from "@/components/documents/terms-section";
import { DocumentFooter } from "@/components/documents/document-footer";
import type { DocumentPreviewData } from "@/lib/types/document";

/**
 * Shared A4 letterhead-style document used for both quotation and invoice
 * previews. Renders identically on screen and in print/PDF output — only the
 * data fed in differs between the two document types.
 */
export function DocumentPreview({ doc }: { doc: DocumentPreviewData }) {
  return (
    <div id="document-preview-container" className="document-page flex flex-col rounded-sm border p-10 print:rounded-none print:border-0 bg-white text-gray-900 font-sans shadow-sm">
      <DocumentHeader doc={doc} />

      <div className="grid grid-cols-2 gap-6 py-6">
        <CompanyDetails company={doc.company} />
        <CustomerDetails customer={doc.customer} />
      </div>

      <DocumentItemsTable items={doc.items} />

      {/* Pinned to the bottom of the page: totals, then payment conditions / notes / terms, then the footer. On longer documents it simply follows the items. */}
      <div data-pdf-anchor-bottom className="mt-auto">
        <div className="prevent-break py-6">
          <DocumentTotals
            subtotalPaise={doc.subtotalPaise}
            discountPaise={doc.discountPaise}
            taxPaise={doc.taxPaise}
            shippingPaise={doc.shippingPaise}
            totalPaise={doc.totalPaise}
            amountPaidPaise={doc.amountPaidPaise}
          />
        </div>
        <TermsSection notes={doc.notes} terms={doc.terms} paymentTerms={doc.paymentTerms} />
        <DocumentFooter company={doc.company} />
      </div>
    </div>
  );
}
