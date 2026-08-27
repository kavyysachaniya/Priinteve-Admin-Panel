import { formatCurrency, formatNumber } from "@/lib/money";
import type { DocumentPreviewItem } from "@/lib/types/document";

export function DocumentItemsTable({ items }: { items: DocumentPreviewItem[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-gray-800 text-left text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
          <th className="w-8 py-2 pr-2">#</th>
          <th className="py-2 pr-2">Item</th>
          <th className="w-16 py-2 pr-2 text-right">Qty</th>
          <th className="w-24 py-2 pr-2 text-right">Rate</th>
          <th className="w-16 py-2 pr-2 text-right">Disc.</th>
          <th className="w-16 py-2 pr-2 text-right">GST</th>
          <th className="w-28 py-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={idx} className="border-b border-gray-200 align-top">
            <td className="py-2.5 pr-2 text-gray-500">{idx + 1}</td>
            <td className="py-2.5 pr-2">
              <p className="font-medium text-gray-800">{item.name}</p>
              {item.description && <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>}
            </td>
            <td className="py-2.5 pr-2 text-right text-gray-700">{formatNumber(item.quantity)}</td>
            <td className="py-2.5 pr-2 text-right text-gray-700">{formatCurrency(item.ratePaise)}</td>
            <td className="py-2.5 pr-2 text-right text-gray-700">{item.discountPercent > 0 ? `${item.discountPercent}%` : "—"}</td>
            <td className="py-2.5 pr-2 text-right text-gray-700">{item.gstRate}%</td>
            <td className="py-2.5 text-right font-medium text-gray-800">{formatCurrency(item.amountPaise)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
