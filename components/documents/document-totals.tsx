import { formatCurrency } from "@/lib/money";

export function DocumentTotals({
  subtotalPaise,
  discountPaise,
  taxPaise,
  shippingPaise,
  totalPaise,
  amountPaidPaise,
}: {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
  /** When provided, renders Amount Paid / Balance Due rows (invoices only). */
  amountPaidPaise?: number;
}) {
  const showPayments = amountPaidPaise !== undefined;
  const outstanding = totalPaise - (amountPaidPaise ?? 0);

  return (
    <div className="ml-auto w-full max-w-[280px] space-y-1.5 text-sm">
      <Row label="Subtotal" value={formatCurrency(subtotalPaise)} />
      {discountPaise > 0 && <Row label="Discount" value={`− ${formatCurrency(discountPaise)}`} />}
      <Row label="Tax (GST)" value={formatCurrency(taxPaise)} />
      {shippingPaise > 0 && <Row label="Shipping / Other" value={formatCurrency(shippingPaise)} />}
      <div className="flex items-center justify-between border-t border-gray-300 pt-1.5 text-base font-semibold text-gray-900">
        <span>Grand Total</span>
        <span>{formatCurrency(totalPaise)}</span>
      </div>
      {showPayments && (
        <>
          <Row label="Amount Paid" value={formatCurrency(amountPaidPaise ?? 0)} />
          <div className="flex items-center justify-between border-t border-gray-300 pt-1.5 font-semibold text-gray-900">
            <span>Balance Due</span>
            <span>{formatCurrency(outstanding)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-gray-600">
      <span>{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}
