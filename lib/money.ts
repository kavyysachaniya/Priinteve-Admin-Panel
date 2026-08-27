/**
 * Money handling utilities.
 *
 * All monetary amounts are persisted and computed as integer paise (1/100 of
 * a rupee). This sidesteps floating point rounding errors entirely — sums,
 * discounts, and tax are all done with plain integer arithmetic and only
 * converted to a decimal rupee value at the point of display.
 *
 * Never do currency math with `number` rupee values (e.g. `19.99 + 0.01`).
 * Convert to paise first with `rupeesToPaise`, do the arithmetic, then format
 * with `formatCurrency` / `paiseToRupees` for display.
 */

export function rupeesToPaise(rupees: number): number {
  // Round to the nearest paisa to absorb float noise from user input (e.g. 19.1 * 100).
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Percentage as e.g. 18 for 18%. Rounds to the nearest paisa. */
export function applyPercent(paise: number, percent: number): number {
  return Math.round((paise * percent) / 100);
}

export function sumPaise(values: number[]): number {
  return values.reduce((total, v) => total + Math.round(v), 0);
}

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_FORMATTER_NO_DECIMALS = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format paise as a localized INR currency string, e.g. "₹1,82,450.00". */
export function formatCurrency(paise: number, opts?: { decimals?: boolean }): string {
  const rupees = paiseToRupees(paise);
  return opts?.decimals === false
    ? INR_FORMATTER_NO_DECIMALS.format(rupees)
    : INR_FORMATTER.format(rupees);
}

/** Format a plain number (not currency) the Indian way, e.g. "1,82,450". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export interface LineItemInput {
  quantity: number;
  ratePaise: number;
  discountPercent: number;
  gstRate: number;
}

export interface LineItemComputed {
  grossPaise: number; // quantity * rate, before discount
  discountPaise: number;
  taxableAmountPaise: number; // gross - discount
  gstPaise: number;
  amountPaise: number; // taxable + gst — the line total
}

/** Compute a single line item's amounts from quantity/rate/discount/gst. */
export function computeLineItem(item: LineItemInput): LineItemComputed {
  const grossPaise = Math.round(item.quantity * item.ratePaise);
  const discountPaise = applyPercent(grossPaise, item.discountPercent);
  const taxableAmountPaise = grossPaise - discountPaise;
  const gstPaise = applyPercent(taxableAmountPaise, item.gstRate);
  const amountPaise = taxableAmountPaise + gstPaise;
  return { grossPaise, discountPaise, taxableAmountPaise, gstPaise, amountPaise };
}

export interface DocumentTotals {
  subtotalPaise: number; // sum of taxable amounts (after line discounts, before tax)
  discountPaise: number; // sum of line discounts
  taxPaise: number; // sum of line gst
  shippingPaise: number;
  totalPaise: number;
}

/** Aggregate a set of line items (+ optional shipping) into document totals. */
export function computeDocumentTotals(
  items: LineItemInput[],
  shippingPaise = 0
): DocumentTotals {
  const computed = items.map(computeLineItem);
  const subtotalPaise = sumPaise(computed.map((c) => c.taxableAmountPaise));
  const discountPaise = sumPaise(computed.map((c) => c.discountPaise));
  const taxPaise = sumPaise(computed.map((c) => c.gstPaise));
  const totalPaise = subtotalPaise + taxPaise + shippingPaise;
  return { subtotalPaise, discountPaise, taxPaise, shippingPaise, totalPaise };
}
