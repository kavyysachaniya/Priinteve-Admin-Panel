const ROWS: { key: "paid" | "partiallyPaid" | "unpaid" | "overdue" | "draft"; label: string; tone: string }[] = [
  { key: "paid", label: "Paid", tone: "bg-success" },
  { key: "partiallyPaid", label: "Partially Paid", tone: "bg-warning" },
  { key: "unpaid", label: "Unpaid (Sent)", tone: "bg-primary" },
  { key: "overdue", label: "Overdue", tone: "bg-destructive" },
  { key: "draft", label: "Draft", tone: "bg-muted-foreground" },
];

export function InvoiceSummaryBreakdown({
  summary,
}: {
  summary: Record<"paid" | "partiallyPaid" | "unpaid" | "overdue" | "draft", number>;
}) {
  const total = Object.values(summary).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">Invoice Summary</h3>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {ROWS.map((row) =>
              summary[row.key] > 0 ? (
                <div
                  key={row.key}
                  className={row.tone}
                  style={{ width: `${(summary[row.key] / total) * 100}%` }}
                  title={`${row.label}: ${summary[row.key]}`}
                />
              ) : null
            )}
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {ROWS.map((row) => (
              <li key={row.key} className="flex items-center gap-2">
                <span className={`size-2 shrink-0 rounded-full ${row.tone}`} />
                <span className="text-muted-foreground">{row.label}</span>
                <span className="ml-auto font-medium">{summary[row.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
