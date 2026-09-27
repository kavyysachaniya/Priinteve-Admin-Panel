# Business Logic

The business rules implemented in the code, with the file that enforces each one. When this document and the code disagree, the code wins — update this file.

Related: [DATABASE.md](./DATABASE.md) · [PROJECTS.md](./PROJECTS.md) · [DOCUMENTS.md](./DOCUMENTS.md) · [MODULES.md](./MODULES.md)

---

## The main flow

```text
Customer → Quotation → Sent → Accepted ─┬─→ Invoice → Sent → Payments → Paid
                                         └─→ Order → Production jobs → Delivery
```

Invoices can also be created directly, and orders can also be created without a quotation.

## Money and rounding

Source: `lib/money.ts`.

- All amounts are integer **paise**. Form input in rupees goes through `rupeesToPaise()` (`Math.round(rupees × 100)`); output goes through `formatCurrency()` (`en-IN`, `INR`).
- `applyPercent(paise, percent)` = `Math.round(paise × percent / 100)`. Every percentage rounds to the nearest paisa at the point it's applied.

### Quotation and invoice lines — `computeLineItem()`

| Step | Formula |
|---|---|
| Gross | `round(quantity × ratePaise)` |
| Discount | `applyPercent(gross, discountPercent)` |
| Taxable | `gross − discount` |
| GST | `applyPercent(taxable, gstRate)` |
| Line amount | `taxable + GST` |

### Quotation and invoice totals — `computeDocumentTotals()`

| Field | Value |
|---|---|
| `subtotalPaise` | Sum of line taxable amounts (after discount, before tax) |
| `discountPaise` | Sum of line discounts (shown for information; already deducted from the subtotal) |
| `taxPaise` | Sum of line GST |
| `shippingPaise` | Shipping / other charge entered on the form |
| `totalPaise` | `subtotal + tax + shipping` |

### Order totals — `computeFlatRateTotals()`

Orders use one document-level discount and one GST rate:

| Field | Value |
|---|---|
| Line total | `round(quantity × unitPricePaise)` |
| Discount | The form's discount in paise, clamped to 0 … sum of lines |
| `subtotalPaise` | Sum of lines − discount |
| `taxPaise` | `applyPercent(subtotal, CompanySettings.defaultGstRate)` |
| `totalPaise` | `subtotal + tax + shipping` |

Totals are always **recomputed on the server** when quotations, invoices and orders are saved. Totals posted by a form are ignored. Expenses are the exception — see [Expenses](#expenses).

## Quotations

Source: `lib/services/quotations.ts`.

### Status transitions

| From | Allowed next status |
|---|---|
| `DRAFT` | `SENT` |
| `SENT` | `ACCEPTED`, `REJECTED`, `EXPIRED` |
| `ACCEPTED` | `REJECTED` |
| `REJECTED`, `EXPIRED`, `CONVERTED` | none |

`CONVERTED` is set only by conversion to an invoice. No code moves a quotation to `EXPIRED` automatically when `validUntil` passes. The UI (`components/quotations/quotation-actions.tsx`) offers Sent, Accepted and Rejected buttons only.

### Other rules

- **Create:** status `DRAFT`, number `QTN-YYYY-NNNN`. Terms are whatever the form contains; the Settings "Default Quotation Terms" are not applied anywhere.
- **Form defaults** (`lib/validations/quotation.ts`, `document-item.ts`): issue date today, valid for 15 days, new lines at 18% GST. These are hard-coded; `CompanySettings.defaultValidityDays` is not used.
- **Validation:** at least one line; quantity > 0; rate ≥ 0; discount 0–100%; GST 0–100%; `validUntil` on or after `issueDate`; notes and terms up to 2,000 characters.
- **Edit:** allowed in every status except `CONVERTED`. Editing replaces all lines and recomputes totals.
- **Delete:** only `DRAFT`.
- **Duplicate:** creates a new `DRAFT` with today's date, validity 15 days, and the same customer, notes, terms, lines and totals.

## Quotation → Invoice conversion

Source: `convertQuotationToInvoice()` in `lib/services/quotations.ts`.

- Only `ACCEPTED` quotations, and only once. `Invoice.sourceQuotationId` is unique, and the service also checks for an existing invoice.
- The new invoice is a `DRAFT` dated today, due `today + CompanySettings.defaultDueDays`.
- It copies the customer, notes, lines and all totals. Its terms come from `CompanySettings.invoiceTerms`, not from the quotation.
- The quotation becomes `CONVERTED`. That is terminal: it can't be edited, and the convert buttons disappear.
- An invoice created from a quotation can **never be edited** (`assertEditable()` in `invoices.ts`).

## Quotation → Order conversion ("Book Print Order")

Source: `convertQuotationToOrder()` in `lib/services/orders.ts`.

- Only `ACCEPTED` quotations, and only once (`Order.sourceQuotationId` is unique).
- Creates a `CONFIRMED` order with `MEDIUM` priority, dated today, expected completion = the quotation's `validUntil`. It copies lines (including per-line GST and discount) and totals, including shipping.
- Creates one `PENDING` production job per line.
- It does **not** change the quotation's status. The quotation stays `ACCEPTED`, so it can still be converted to an invoice afterwards. The "Book Print Order" button is shown only while the quotation is `ACCEPTED` and has no invoice.

## Invoices

Source: `lib/services/invoices.ts`.

### Stored status

The `status` column changes only on these events:

| Event | From | To | Also |
|---|---|---|---|
| Create / convert | — | `DRAFT` | number `INV-YYYY-NNNN` |
| Mark as Sent | `DRAFT` only | `SENT` | posts the invoice journal entry |
| Payment recorded | any except `CANCELLED` | `PARTIALLY_PAID`, or `PAID` when fully paid | see [Payments](#payments) |
| Payment deleted | — | `PAID` / `PARTIALLY_PAID` / `SENT` from the new paid amount | a fully unpaid invoice becomes `SENT` even if it was a draft |
| Cancel | not `CANCELLED` and no payments | `CANCELLED` | reverses the invoice journal entry if one was posted |

### Displayed status — `deriveInvoiceStatus()`

`OVERDUE` is never stored. Pages show `effectiveStatus`:

1. `DRAFT`, `CANCELLED` and `PAID` are shown as stored.
2. Paid amount ≥ total → `PAID`.
3. Due date in the past → `OVERDUE`.
4. Anything paid → `PARTIALLY_PAID`.
5. Otherwise the stored status.

Always display and filter on `effectiveStatus`, never the raw `status`. The invoice list's status filter is applied after deriving, in memory.

### Other rules

- **Editable** only when the invoice did not come from a quotation, has no payments, and isn't cancelled. `SENT` invoices can be edited; their already-posted journal entry is **not** updated.
- **Terms on create:** the form's terms, or `CompanySettings.invoiceTerms` if left empty. On edit, empty terms are saved as empty.
- **Form defaults** (`lib/validations/invoice.ts`): invoice date today, due in 15 days (hard-coded), lines at 18% GST.
- **No delete.** Invoices are cancelled. Cancelled invoices are excluded from revenue and outstanding totals.

## Payments

Source: `lib/services/payments.ts`.

- **Amount:** must be > 0 and ≤ the invoice's outstanding balance (`totalPaise − amountPaidPaise`).
- The invoice must exist, belong to the selected customer, and not be `CANCELLED`.
- **Concurrency:** create and delete run in a **Serializable** transaction. A serialization conflict (`P2034`) is retried once, then reported as "This invoice was updated by another payment at the same time. Please retry." Two simultaneous payments can't together exceed the balance.
- **Recording** increases `amountPaidPaise`, sets the status to `PARTIALLY_PAID` or `PAID`, posts a journal entry, and logs activity.
- **Deleting** reverses the payment's journal entry, lowers `amountPaidPaise`, and recalculates the status.
- The Record Payment picker (`listPayableInvoices()`) lists every non-cancelled invoice with a balance, **including drafts**.
- Payment methods: `CASH`, `UPI`, `BANK_TRANSFER`, `CARD`, `OTHER`.

## Outstanding balances

"Outstanding" is calculated differently depending on where it's shown:

| Where | Definition | Source |
|---|---|---|
| Invoice page | `total − amountPaid` | `app/(app)/invoices/[id]/page.tsx` |
| Dashboard "Outstanding Payments" card | Sum over all non-cancelled invoices, **including drafts** | `getSummaryCards()` in `dashboard.ts` |
| Customer list and detail | Sum over the customer's non-cancelled invoices | `customers.ts` |
| Receivables report, Finance overview | Invoices that are not `DRAFT` or `CANCELLED`, grouped by customer, with days overdue | `getReceivables()` in `accounting/reports.ts` |

## Revenue recognition

There are two views of revenue, and they won't always match:

| View | Basis | Period | Source |
|---|---|---|---|
| **Dashboard** KPI cards and chart | **Cash:** sum of `Payment.amountPaise` by `paymentDate`; expenses are `RECORDED` expenses by `date` | Cards: current calendar month vs last month. Chart: 7 days, 30 days, this month or this year. | `lib/services/dashboard.ts` |
| **Finance overview** and **Reports** (P&L, balance sheet, cash flow, GST) | **Journal:** `POSTED` journal lines on income and expense accounts. Invoice revenue is recognized when the invoice is marked Sent, dated on the invoice date. | Finance: current year to date. Reports: selectable range. | `lib/services/accounting/reports.ts` |

Invoices still in `DRAFT` appear in neither view. `lib/services/finance.ts` (an older all-time, cash-based overview) is no longer used by any page.

## GST and tax

- **Quotations and invoices:** GST is per line (`gstRate` on each item). The rate defaults to 18% for new lines; picking a product uses the product's `gstRate`.
- **Orders:** one rate for the whole order, `CompanySettings.defaultGstRate` (editable in Settings, 0–100). The order form shows it as "Order Total (Inc GST x%)".
- **Expenses:** the form supplies `gstRate`, `gstAmountPaise` and `totalAmountPaise`; the server stores them as given.
- **Accounting:** invoice GST is credited to **2100 Output GST Payable**; expense GST is debited to **1200 Input GST Receivable**. The GST report (`/finance/tax`) shows output − input for the chosen range.
- **Not implemented:** no CGST/SGST/IGST split. The order form's `cgstPaise`/`sgstPaise`/`igstPaise` fields are always 0 and ignored, and account 2200 IGST Payable is never posted to.

## Discounts

| Document | Discount type | Limits |
|---|---|---|
| Quotation, invoice | Per line, percent | 0–100% |
| Order | One amount in paise for the whole order | Clamped to 0 … sum of lines |

## Orders

Source: `lib/services/orders.ts`.

- **Create:** status `DRAFT` (schema default), number `ORD-YYYY-NNNN`. One `PENDING` production job is created per line, numbered `PROD-YYYY-NNNN`.
- **Form:** title (stored in `Order.notes`), priority, order date, expected completion, lines (integer quantity ≥ 1, unit price), discount. There is no shipping field; shipping comes only from a converted quotation and is kept on edit.
- **Edit:** replaces all lines and recomputes totals with the current default GST rate. On an order converted from a quotation, this replaces the quotation's per-line GST and discounts with the single-rate calculation. Editing does not add or remove production jobs.
- **Status:** `updateOrderStatus()` accepts any `OrderStatus` with no transition rules. Production and delivery changes also set it automatically (below).
- **Delete:** `orders:delete`; also deletes its lines, production jobs and delivery.

## Production

Source: `lib/services/production.ts`.

- Stages: `PENDING → ASSIGNED → IN_PROGRESS → QUALITY_CHECK → COMPLETED`, plus `ON_HOLD`. Any stage can be set from any other.
- Each change writes a `ProductionJobHistory` row. `COMPLETED` also sets `actualCompletionDate`.
- **Order sync:** after every stage change, the parent order becomes `READY` if all its jobs are `COMPLETED`, otherwise `IN_PRODUCTION`. This overwrites the order's status even if it was already delivered, completed or cancelled.
- **Manual jobs** (`/production/new`, `production:create`) take the order, optional line/product, quantity, assignee, dates, priority and internal notes. The customer always comes from the order.
- **Assignment** can only be set when a job is created manually. Jobs created from orders are unassigned, and there is no action to change the assignee. Stage changes are not limited to the assignee ([AUTHORIZATION.md](./AUTHORIZATION.md#roles-and-permissions)).

## Deliveries

Source: `lib/services/deliveries.ts`.

- One delivery per order (`Delivery.orderId` unique; the service also checks). Numbered `DEL-YYYY-NNNN`, status `PENDING`. The customer comes from the order.
- Statuses: `PENDING`, `SCHEDULED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, `RETURNED`. There are no transition rules, and every change writes a history row.
- **Order sync:** `OUT_FOR_DELIVERY` → order `OUT_FOR_DELIVERY`; `DELIVERED` → order `DELIVERED` and sets `actualDeliveryDate`. Other statuses leave the order alone.

## Expenses

Source: `lib/services/expenses.ts`.

- Statuses: `DRAFT`, `RECORDED`, `CANCELLED`. Only `RECORDED` expenses count toward dashboard totals, the expense breakdown, payables and vendor totals.
- Amounts (`baseAmountPaise`, `gstRate`, `gstAmountPaise`, `totalAmountPaise`) are computed in the form and **stored as submitted**, not recomputed on the server.
- **Create:** if `RECORDED`, posts a journal entry (debit the expense account plus input GST, credit cash/bank). This runs after the expense is saved; if it fails, the error is logged and the expense is kept.
- **Edit:** updates the expense only. The journal entry is not adjusted, even if the amount or status changes, and changing `DRAFT` → `RECORDED` does not post one.
- **Delete:** posts a reversal of the expense's journal entry (failures are logged and ignored), then deletes the expense.
- **Expense account** is chosen by category name (`EXPENSE_CATEGORY_MAP` in `auto-accounting.ts`); unknown categories use **5900 Other Expenses**.

## Accounting

Sources: `lib/services/accounting/*.ts`.

### Chart of accounts

- The default chart (`DEFAULT_CHART_OF_ACCOUNTS` in `accounts.ts`) is created the first time someone opens `/accounts` and finds no accounts (`seedChartOfAccounts()`).
- **Until then, auto-accounting is skipped silently.** Invoices marked Sent, payments and expenses post no journal entries, and nothing back-fills them later.
- Balances are computed from `POSTED` lines plus the opening balance: debit-normal for assets and expenses, credit-normal for liabilities, equity and income.

### Automatic journal entries — `auto-accounting.ts`

| Event | Debit | Credit |
|---|---|---|
| Invoice marked Sent | 1100 Accounts Receivable (total) | 4900 Other Service Revenue (subtotal + shipping); 2100 Output GST Payable (tax) |
| Payment recorded | Cash/bank account (see below) | 1100 Accounts Receivable |
| Expense recorded | Expense account (base); 1200 Input GST Receivable (GST) | Cash/bank account (total) |
| Invoice cancelled, payment deleted, expense deleted | Reversal entry mirroring the original | |

- All invoice revenue goes to **4900**. `REVENUE_ACCOUNT_CODES` (4010–4050) is defined but not used.
- **Cash/bank account:** the payment's `paymentAccountId` if set (the forms never set it); otherwise by method — `BANK_TRANSFER`/`CARD` → 1020 Bank Account, `UPI` → 1030 UPI Account (1020 if missing), `CASH`/`OTHER` → 1010 Cash in Hand.
- Auto entries are created already `POSTED`.

### Journal rules — `journal.ts`

- An entry needs at least 2 lines. Amounts are non-negative, no line has both a debit and a credit, every line has an account, and total debits = total credits > 0.
- Manual entries (`/accounting/journal/new`) are entered in rupees, converted to paise, and posted immediately.
- **Reversal** creates a new posted entry with debits and credits swapped and links it through `reversedById`. The original is never deleted or edited. An entry can be reversed once, and manual reversal requires a reason.

### Accounting periods

`AccountingPeriod` rows can be created and toggled `OPEN`/`CLOSED` at `/accounting/periods`. **Closing a period does not block anything**: no code checks periods when posting (`isDateInOpenPeriod()` exists but is unused). Only `scripts/test-flow.ts` respects closed periods when it cleans up.

### Reports — `reports.ts`

- **P&L:** income and expense accounts, `POSTED` lines in the range.
- **Balance sheet:** asset, liability and equity balances as of a date, plus retained earnings = cumulative P&L from 2020-01-01. It flags an imbalance larger than 1 paisa.
- **Cash flow:** debits (inflows) and credits (outflows) on accounts 1010, 1020 and 1030 in the range, with an opening balance from earlier entries.
- **GST:** output GST credits (2100) and input GST debits (1200) in the range.
- **Receivables:** see [Outstanding balances](#outstanding-balances).
- **Payables:** every `RECORDED` expense that has a vendor is listed as outstanding. There is no way to mark an expense as paid.
- Date presets: today, this week, this month, last month, this quarter, this year, custom.

## Customers and products

- Only `ACTIVE` customers and products appear in pickers on new documents (`listAllActiveCustomers()`, `listAllActiveProducts()`).
- Customers can be created inline from the customer picker (quick-create dialog).
- **Customer delete** is blocked if they have quotations, invoices or payments ("Mark them Inactive instead"); orders also block it at the database level.
- **Customer totals:** "total business" and "outstanding" use non-cancelled invoices, including drafts.
- **Product delete** is blocked if the product appears on any quotation or invoice line.
- Product categories are free text; saving a product creates the category if it doesn't exist.

## Tasks, notes and calendar

- **Tasks:** statuses `TODO`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. The quick toggle switches between `COMPLETED` and `TODO`. The list page has a status filter; the service and URL also accept `dueDate=today|overdue|upcoming|YYYY-MM-DD`.
- **Notes:** can be pinned; the planner shows up to 5 pinned notes.
- **Calendar view** combines manual events, tasks with due dates, delivery dates, production due dates, and due dates of invoices not `PAID`.
- **iCal feed** (`/api/calendar/feed`): events, tasks, deliveries and production due dates from 2 months ago to 6 months ahead. Times are written with a `Z` (UTC) suffix although they were entered as local times — see [MODULES.md](./MODULES.md#calendar).
- **Planner** (`/planner?date=`): tasks, events, orders due, and deliveries for one day, plus pinned notes.

## Activity log

`logActivity()` in `lib/services/activity.ts` records business events with a `type` (such as `invoice.created` or `TIMER_STARTED`), a message, and links to the related records. It is best-effort: failures never break the main operation. Activity appears on the dashboard and on the customer, quotation, invoice, order, production job, delivery, vendor and project detail pages.

## Known gaps

These are current behaviours that may surprise you. They are documented, not fixed.

| Gap | Where |
|---|---|
| Settings "Default Quotation Terms" and "Quotation Validity (days)" are never applied | `quotations.ts`, `lib/validations/quotation.ts` |
| Invoice form's default due period is hard-coded to 15 days, not `defaultDueDays` | `lib/validations/invoice.ts` |
| Payments can be recorded against `DRAFT` invoices; the invoice then can't be marked Sent, so its revenue journal is never posted | `payments.ts`, `invoices.ts` |
| Editing a `SENT` invoice doesn't update its posted journal entry | `invoices.ts` |
| Editing an expense doesn't adjust its journal entry | `expenses.ts` |
| Production stage changes overwrite the order status even after delivery or cancellation | `production.ts` |
| Closed accounting periods are not enforced | `accounting/periods.ts` |
| No automatic `EXPIRED` status for quotations past `validUntil` | `quotations.ts` |
| Most list searches are case-sensitive | services using `contains` without `mode: "insensitive"` |
