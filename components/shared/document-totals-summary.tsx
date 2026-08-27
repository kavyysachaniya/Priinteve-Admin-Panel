import { formatCurrency } from "@/lib/money";

export function DocumentTotalsSummary({
  subtotalPaise,
  discountPaise,
  taxPaise,
  shippingSlot,
  totalPaise,
}: {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  /** Editable shipping charge input, rendered where the shipping row's value normally goes. */
  shippingSlot: React.ReactNode;
  totalPaise: number;
}) {
  return (
    <div className="w-full max-w-xs space-y-2 self-end rounded-lg border bg-card p-4 text-sm">
      <Row label="Subtotal" value={formatCurrency(subtotalPaise)} />
      {discountPaise > 0 && <Row label="Discount" value={`− ${formatCurrency(discountPaise)}`} muted />}
      <Row label="Tax (GST)" value={formatCurrency(taxPaise)} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Shipping / Other</span>
        {shippingSlot}
      </div>
      <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-semibold">
        <span>Grand Total</span>
        <span>{formatCurrency(totalPaise)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? "text-muted-foreground" : ""}>{value}</span>
    </div>
  );
}
