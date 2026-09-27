# Quotation and Invoice Documents

How the printable A4 quotation and invoice are built, printed and exported to PDF.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md) · [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#documents-and-pdf)

---

## Where documents appear

| Page | Template | Print | Download PDF |
|---|---|---|---|
| `/quotations/[id]` | `DocumentPreview` | No button — the browser's own print (Ctrl+P / ⌘P) uses the same print CSS | No |
| `/invoices/[id]` | `DocumentPreview` | **Print** button (`components/documents/print-button.tsx`) | **Download PDF** button (`components/documents/download-pdf-button.tsx`) |

Both pages build a `DocumentPreviewData` object (`lib/types/document.ts`) on the server and render `<DocumentPreview doc={doc} />`. Only the data differs; the layout is shared.

## Document order

The template (`components/documents/document-preview.tsx`) always renders these sections in this order:

1. **Header** — letterhead on the left, document title and number on the right.
2. **From / Bill To** — company details and customer details in two columns.
3. **Items table** — one row per line item.
4. **Totals** — right-aligned summary.
5. **Bottom block**, pinned to the bottom of the page:
   1. **Notes** and **Terms & Conditions** (side by side);
   2. **Bank Details** and the thank-you line (footer).

The bottom block is wrapped in `<div data-pdf-anchor-bottom className="mt-auto">`. The page container is a flex column with a minimum height of one A4 page, so on a short document the block sits at the bottom of the page. On a long document it follows the totals on the last page.

## Sections in detail

| Section | Component | Content |
|---|---|---|
| Header | `document-header.tsx` | A dark square with the letter **P** (static — `CompanySettings.logoUrl` is not used); company `name` and `tagline`; the title (`QUOTATION` / `INVOICE`); the number; two dates — Issue Date + Valid Until (quotation) or Invoice Date + Due Date (invoice) |
| From | `company-details.tsx` | Company name, address lines, city/state/pincode, phone, email, GSTIN — each only if set |
| Bill To | `customer-details.tsx` | Customer name, "Attn:" contact person (business customers only), billing address, city/state/pincode, phone, email, GSTIN |
| Items | `document-items-table.tsx` | Columns: `#`, Item (name + optional description), Qty, Rate, Disc. (`—` when 0), GST %, Amount (line total incl. GST) |
| Totals | `document-totals.tsx` | Subtotal; Discount (only if > 0); Tax (GST); Shipping / Other (only if > 0); **Grand Total**. Invoices also show Amount Paid and **Balance Due**. |
| Notes / Terms | `terms-section.tsx` | The document's `notes` and `terms`, line breaks kept. Each column appears only if it has text; the whole section is omitted if both are empty. |
| Bank details / footer | `document-footer.tsx` | "Bank Details" (account name, bank + branch, account number, IFSC) — shown only if `bankName` or `bankAccountNumber` is set in Settings. Always ends with "Thank you for your business — {company name}". |

### Where the data comes from

| Data | Source |
|---|---|
| Company, letterhead, bank details | `CompanySettings`, read with `getCompanySettings()` every time the page renders — Settings changes apply to existing documents too |
| Customer | The document's customer record, as it is now (not a snapshot) |
| Items, totals, notes, terms, dates | Stored on the quotation or invoice |
| Invoice terms default | `CompanySettings.invoiceTerms`, copied onto the invoice when it's created with empty terms or converted from a quotation |
| Quotation terms | Only what was typed on the quotation form; the Settings default isn't applied |

See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#money-and-rounding) for how the totals are calculated.

## Print

**Print** calls `window.print()`. The print styles are in `app/globals.css`:

```css
@media print {
  @page { size: A4; margin: 14mm; }
  .print-hide { display: none !important; }
  .document-page { width: auto; min-height: 267mm; box-shadow: none; margin: 0; }
}
.document-page tr,
.document-page .prevent-break { page-break-inside: avoid; break-inside: avoid; }
```

- `267mm` is one printable A4 page (297 mm − 2 × 14 mm margins) less a small buffer, so a one-page document never spills a blank second page.
- Table rows, the notes/terms block (`prevent-break`) and the bank-details footer (`prevent-break`) are never split across pages.
- The detail pages wrap their page header, action buttons, activity and payment history in `print-hide`.
- `components/layout/app-shell.tsx` hides the sidebar and topbar (`print-hide`) and uses `print:` Tailwind variants to release the scrolling, viewport-height shell, so the printout isn't clipped to one screen.
- To get a PDF this way, choose "Save as PDF" in the print dialog. The text stays selectable.

## Download PDF

**Download PDF** calls `exportElementToPdf(element, fileName)` in `lib/pdf/exporter.ts` on the `#document-preview-container` element. The file is named after the invoice number (for example `INV-2026-0001.pdf`).

How it works:

1. **Measure break points.** Before capturing, it records the top edge of every content block inside the container: each direct child, each table row (`tr`) instead of the whole table, and each child of the `data-pdf-anchor-bottom` wrapper (the notes/terms block and the footer).
2. **Capture.** It renders the element to a PNG with `html-to-image` (`toPng`, pixel ratio 2.5, white background). If that throws, it falls back to `html2canvas` (scale 2.5).
3. **Scale.** The image is scaled to A4 width (210 mm). Its height follows from the element's on-screen aspect ratio.
4. **Paginate.** For each page, it cuts at the last measured block edge that fits within 297 mm. Only if a single block is taller than a page does it cut at exactly 297 mm.
5. **Draw.** The whole image is placed on every page with a negative vertical offset. Everything below that page's cut is covered with a white rectangle, so the block that starts the next page doesn't also appear partly cut off at the bottom. The fill colour is set on every page because jsPDF resets it per page.
6. **Save** with `jsPDF` (A4, portrait, mm units, compressed).

The same exporter powers **Export PDF** on the report pages (`components/reports/report-export-buttons.tsx`, element `#report-container`).

## Limitations and gotchas

- **Quotations have no Print or Download PDF button.** Only the browser's own print works on the quotation page.
- **The downloaded PDF is an image.** Text can't be selected or searched. Use Print → "Save as PDF" when you need selectable text.
- **The PDF has no page margins of its own.** Pages after the first start directly at the cut line, and the table header row is not repeated.
- **The PDF follows the on-screen width.** The preview is at most 210 mm wide. If the browser window is narrower, the captured image is scaled up to A4 width, the document becomes taller, and a one-page invoice can spill onto a second page. Export from a window wide enough to show the full A4 preview.
- **The logo field is unused.** The letterhead always shows the "P" monogram.
- **Bank details are optional.** If Settings has neither a bank name nor an account number, the Bank Details block is left out and only the thank-you line remains.
- **Keep the structure the exporter relies on.** If you add a section to `DocumentPreview`, make it a direct child of the container (or a child of the `data-pdf-anchor-bottom` wrapper) so it becomes a break point. Blocks nested deeper can be cut in the PDF.
- **Keep `prevent-break`** on blocks that must not be split when printed.
