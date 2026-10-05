# Testing

How changes are verified in this project. There is **no unit-test framework** (no Jest, Vitest or Playwright tests) and no `npm test` script. Verification is static checks, three scripts that run the real service layer against a database, and manual checks in the browser.

Related: [DEVELOPMENT.md](./DEVELOPMENT.md) · [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md)

---

## Static checks

| Command | Expectation |
|---|---|
| `npx tsc --noEmit` | Must pass. It passed on 2026-09-27. |
| `npm run lint` | The codebase has 38 errors and 68 warnings from older code (2026-09-27). Don't add new ones — lint the files you changed, for example `npx eslint lib/services/orders.ts`. |
| `npm run build` | Must pass before deploying. |

## Verification scripts

All run with `npx tsx`. Except `test-companion.ts`, they run against the database in `.env`. They call the same service functions the UI uses, so they bypass Server Actions and permission checks.

> [!WARNING]
> These scripts write to whatever database `DATABASE_URL` points at. Prefer a Neon branch. Never point `test-accounting-phase4.ts` at production.

| Script | Covers | Cleans up? | Run after changing |
|---|---|---|---|
| `scripts/test-flow.ts` | Customer → product → quotation → accept → convert → partial + full payment → dashboard/finance | **Yes**, before and after each run | Quotations, invoices, payments, money math, numbering, dashboard |
| `scripts/test-project-timer.ts` | Projects, timer start/pause/resume/stop, concurrency rules, owner-only control, stats | **Only if every step passes** | Projects or timers |
| `scripts/test-companion.ts` | Companion email scoring, time-zone days, SSRF blocking, Slack matching, encryption, website classification (local server). **No database, no external network.** | Nothing to clean | Companion services |
| `scripts/test-accounting-phase4.ts` | Chart of accounts, auto-journals for invoices/payments/expenses, P&L, cash flow, GST, balance sheet | **No** | Accounting, expenses, reports |

### `scripts/test-flow.ts`

```bash
npx tsx scripts/test-flow.ts
```

What it checks:

1. Creates the customer "Test Flow Customer" (`testflow@example.com`) and the product "Digital Business Card" at ₹999 (stored as 99,900 paise).
2. Creates a quotation for 2 × ₹999 at 18% GST and asserts the paise totals: subtotal 199,800, tax 35,964, total 235,764; status `DRAFT`.
3. Marks it Sent, then Accepted.
4. Converts it to an invoice. Checks the customer, total, `sourceQuotationId`, the copied item, and that the quotation is `CONVERTED`.
5. Records ₹1,000 → `PARTIALLY_PAID`, then the remainder → `PAID`, outstanding 0.
6. Checks that the payments list finds both payments by invoice number.
7. Checks that dashboard and finance revenue include the payments.

Cleanup:

- Deletes the test customer's activity rows, journal entries, payments, invoices and quotations, the test product (only if nothing else uses it) and the customer, in one transaction.
- Runs at the start (removing leftovers from earlier runs) and in `finally`.
- Refuses to clean up if a test journal entry falls inside a `CLOSED` accounting period, or if a test customer has orders.
- Numbering sequences are not rolled back, so each run uses up quotation, invoice and journal numbers.

### `scripts/test-project-timer.ts`

```bash
npx tsx scripts/test-project-timer.ts
```

What it checks:

1. Uses the **first user in the database** as the test user (creates one only if there are none).
2. Creates the customer "Acme Corp Design Client" and the projects "Brand Identity Redesign" and "Product Packaging Design".
3. Starting a timer moves the project to `IN_PROGRESS`.
4. A second start on the same project is rejected, and so is a start on another project by the same user.
5. **Ownership:** a temporary second user (`EMPLOYEE`) can't pause or stop the first user's timer, and the timer keeps running. The temporary user is deleted.
6. Pause records ≥ 2 seconds; resume creates a new entry; stop leaves 2 entries totalling ≥ 4 seconds and status `IDLE`.
7. Checks the project statistics.

Cleanup:

- Deletes both projects and the customer at the end, **only when every step passes**.
- If a step fails, the test projects, their time entries and the customer stay behind; delete them by hand. Activity rows written during the run always remain, with their project and customer links set to null.

### `scripts/test-accounting-phase4.ts`

```bash
npx tsx scripts/test-accounting-phase4.ts   # throwaway database only
```

- First it **rewrites the `expense`, `invoice` and `journal` numbering sequences** to follow the highest existing numbers.
- Seeds the chart of accounts, then creates the customer "ABC Restaurant", three products, a quotation converted to an invoice (marked Sent), two payments, a vendor and an expense. It checks the journal entries and reports against them.
- Uses a fixed 2026 date range for its report assertions.
- Deletes nothing: every record it creates stays in the database and in the reports.

## Manual checks

Run the app (`npm run dev`) and sign in. Use an Admin and an Employee account.

### Authentication and permissions

- [ ] Signed out, open `/customers` → redirected to `/login?callbackUrl=/customers`; after signing in you land on `/customers`.
- [ ] As an Employee, the sidebar hides Finance & Accounts, Users and Settings, and `/settings`, `/users` and `/finance` redirect to `/dashboard`.
- [ ] As an Employee, try a delete you lack permission for (for example a customer) → the action is rejected.
- [ ] Deactivate a signed-in test user in another browser → within about a minute their next page load sends them to `/login`.

### Sales flow

- [ ] Create a quotation with several lines, discounts and GST rates; check that the totals match [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#money-and-rounding).
- [ ] Mark it Sent → Accepted → Convert to Invoice; the invoice is `DRAFT` with the same totals and can't be edited.
- [ ] Mark the invoice Sent; record a partial payment, then the rest; the status becomes `PARTIALLY_PAID`, then `PAID`.
- [ ] Try to record more than the outstanding balance → rejected.

### Documents

- [ ] Invoice → **Print**: no sidebar or topbar; Terms & Conditions and Bank Details sit at the bottom of the page; nothing is clipped.
- [ ] Invoice with many lines → **Download PDF**: no row, totals block or terms block is cut across a page break.
- [ ] Quotation page → browser print (Ctrl+P) shows the same layout.

### Orders and projects

- [ ] New order → the total label shows "Inc GST x%" with the rate from Settings, and the total updates as lines change.
- [ ] Projects: start, pause, resume and stop a timer. As a second user, try to pause the first user's running timer → "You can only control your own timer."
