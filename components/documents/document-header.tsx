import { formatDate } from "@/lib/format";
import { BrandLogo } from "@/components/shared/brand-logo";
import type { DocumentPreviewData } from "@/lib/types/document";

export function DocumentHeader({ doc }: { doc: DocumentPreviewData }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-gray-200 pb-6">
      <div className="flex items-center gap-3">
        <BrandLogo src={doc.company.logoUrl} alt={doc.company.name} className="size-11" />
        <div>
          <p className="text-lg font-semibold tracking-tight text-gray-900">{doc.company.name}</p>
          {doc.company.tagline && <p className="text-xs text-gray-500">{doc.company.tagline}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold tracking-tight text-gray-900 uppercase">{doc.kind}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-600">{doc.number}</p>
        <div className="mt-2 space-y-0.5 text-xs text-gray-500">
          <p>{doc.dateLabel}: <span className="text-gray-700">{formatDate(doc.date)}</span></p>
          {doc.secondaryDateLabel && doc.secondaryDate && (
            <p>{doc.secondaryDateLabel}: <span className="text-gray-700">{formatDate(doc.secondaryDate)}</span></p>
          )}
        </div>
      </div>
    </div>
  );
}
