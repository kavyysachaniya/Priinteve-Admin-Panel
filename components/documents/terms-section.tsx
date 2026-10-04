export function TermsSection({
  notes,
  terms,
  paymentTerms,
}: {
  notes: string | null;
  terms: string | null;
  paymentTerms?: string | null;
}) {
  if (!notes && !terms && !paymentTerms) return null;
  return (
    <div className="prevent-break grid grid-cols-1 gap-6 border-t border-gray-200 pt-5 sm:grid-cols-2">
      {paymentTerms && (
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Payment Conditions</p>
          <p className="whitespace-pre-wrap text-xs text-gray-600">{paymentTerms}</p>
        </div>
      )}
      {notes && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Notes</p>
          <p className="whitespace-pre-wrap text-xs text-gray-600">{notes}</p>
        </div>
      )}
      {terms && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Terms &amp; Conditions</p>
          <p className="whitespace-pre-wrap text-xs text-gray-600">{terms}</p>
        </div>
      )}
    </div>
  );
}
