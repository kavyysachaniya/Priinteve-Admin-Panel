@AGENTS.md

# Priinteve Business OS — Phase 1

Internal business management platform for Priinteve (printing, design, and digital
services). Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 +
shadcn/ui (Radix base, Nova preset) + Prisma + SQLite.

## Architecture

- `app/(app)/*` — all authenticated app routes, wrapped by `AppShell`
  (sidebar + topbar) via `app/(app)/layout.tsx`. `app/page.tsx` redirects to
  `/dashboard`.
- `lib/services/*` — all Prisma access lives here. Pages call services
  directly (Server Components); mutations go through `lib/actions/*`
  ("use server" files) which validate with `lib/validations/*` (Zod) before
  calling the service. UI never talks to Prisma directly.
- `lib/money.ts` — **all currency math**. Amounts are stored as integer paise
  in the DB and computed with integer arithmetic — never do money math with
  floating-point rupee values.
- `components/documents/*` — shared A4 letterhead template (`DocumentPreview`)
  used by both quotation and invoice detail pages. PDF "generation" is
  `window.print()` (browser print-to-PDF) against print-specific CSS in
  `app/globals.css` (`.document-page`, `print-hide`).
- `components/shared/*` — reusable pieces used across modules: data table
  toolbar/pagination/filter (URL-driven via searchParams), `ConfirmDialog`,
  `CustomerCombobox` (+ inline quick-create), `DocumentItemsEditor` (the
  quotation/invoice line-item builder, shared by both).

## Business rules worth knowing

- **Invoice status**: persisted status (`DRAFT`/`SENT`/`PARTIALLY_PAID`/`PAID`/`CANCELLED`)
  only changes on explicit events. `OVERDUE` is *derived* at read time in
  `deriveInvoiceStatus()` (lib/services/invoices.ts) from the due date —
  there's no cron job in Phase 1, so always read `effectiveStatus`, not the
  raw `status` column, when displaying to users.
- **Revenue** is recognized on cash receipt (sum of `Payment` rows), not
  invoice totals — kept consistent between the Dashboard and Finance Overview
  in `lib/services/dashboard.ts` / `lib/services/finance.ts`. Expenses don't
  exist yet (`getExpensesTotal()` is a Phase 2 stub returning 0).
- **Quotation → Invoice conversion** is one-way and one-shot: only `ACCEPTED`
  quotations convert (`convertQuotationToInvoice`), and `Invoice.sourceQuotationId`
  is `@unique` so a quotation can't be converted twice.
- **Payments** can't exceed an invoice's outstanding balance (checked
  server-side inside the transaction in `payments.ts`, not just client-side).

## Gotchas hit while building this

- This shadcn preset is Radix-based (`asChild`/`Slot`), **not** the newer
  Base UI preset (`render` prop) — don't mix the two patterns if adding
  components.
- Prisma is pinned to **v6**; Prisma 7 dropped inline `datasource.url` in
  favor of driver adapters, which would need `better-sqlite3` (native
  compile, risky without build tools on Windows).
- A Server Component **cannot** pass a plain closure or event handler as a
  prop to a Client Component (only a Server Action reference, or serializable
  data). Every list-page delete action lives in its own small Client
  Component (e.g. `components/customers/delete-customer-item.tsx`) that
  takes just an `id: string` and builds the `onConfirm`/`onSelect` closures
  itself — don't inline `<ConfirmDialog onConfirm={() => action(id)} />` in
  a `page.tsx`.
- Pages that read the DB with no `searchParams`/dynamic input (e.g.
  `/dashboard`, `/finance`, `/settings`) need `export const dynamic = "force-dynamic"` —
  otherwise Next freezes the query result into the build.

## Verifying changes

`scripts/test-flow.ts` runs the full spec'd business flow (customer → product
→ quotation → accept → convert → partial payment → full payment → dashboard)
directly against the service layer: `npx tsx scripts/test-flow.ts`. Run it
after touching quotation/invoice/payment logic.

## Known Phase 1 scope choices

- No authentication yet — there's a `User` model but no login flow. The
  topbar user menu is a placeholder.
- Local SQLite (`prisma/dev.db`) for now. Swap to Postgres (e.g. via Neon) by
  changing `prisma/schema.prisma`'s datasource and `DATABASE_URL` — the
  service layer doesn't assume SQLite-specific behavior.
- Phase 2 (not built): Expenses, ledger/P&L, cash flow, inventory, vendors,
  orders/production, tasks/calendar, reports.
