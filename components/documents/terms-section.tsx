export function TermsSection({ notes, terms }: { notes: string | null; terms: string | null }) {
  if (!notes && !terms) return null;
  return (
    <div className="grid grid-cols-1 gap-6 border-t border-gray-200 pt-5 sm:grid-cols-2">
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
