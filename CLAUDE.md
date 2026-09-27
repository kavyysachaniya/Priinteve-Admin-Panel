@AGENTS.md

# Priinteve Business OS — instructions for Claude

Internal admin panel for Priinteve (printing, design, digital services): sales (customers → quotations → invoices/orders → payments), operations (production, deliveries), planner, projects with time tracking, and double-entry accounting.

**Stack:** Next.js 16 App Router (Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Radix, `radix-nova`) · Prisma 6 · PostgreSQL on Neon · Auth.js v5 (credentials, JWT) · Zod 4 · react-hook-form · jsPDF.

`AGENTS.md` (imported above) covers repository layout, workflow, security and documentation duties. This file lists the rules for writing code here. Explanations are in `docs/`.

## Architecture rules

- Database access goes in `lib/services/*`. Pages (async Server Components) call services; Client Components never import Prisma. Don't add to the four existing exceptions listed in `docs/ARCHITECTURE.md#services`.
- Every mutation from the UI is a Server Action in `lib/actions/*` with this shape:
  1. `requirePermission(...)`, as the first line;
  2. Zod `safeParse` (schemas in `lib/validations/*`);
  3. the service call, inside `try`;
  4. `revalidatePath(...)`;
  5. return a `FormActionResult` (`lib/actions/utils.ts`).
- Services throw `Error` with a user-readable message when a business rule fails. Multi-step writes use `prisma.$transaction(..., TX_OPTIONS)`. Log notable events with `logActivity()`.
- Every page under `app/(app)` exports `export const dynamic = "force-dynamic"`.
- A new module folder gets a gating `layout.tsx` (copy `app/(app)/customers/layout.tsx`), a `loading.tsx`, and an entry in `lib/nav-config.tsx` with `requiredPermission`.
- Lists are URL-driven: read `searchParams`; use `components/shared/table-*.tsx`.
- Reuse shared pieces before writing new ones: `ConfirmDialog`, `CustomerCombobox`, `DocumentItemsEditor`, `StatusBadge`, `PageHeader`, `StatCard`, `ActivityTimeline`.

## Server vs Client Components

- Server → Client props must be serializable data or Server Action references. No closures, event handlers or component references (such as Lucide icons).
- Each delete/row action is its own small Client Component taking an `id` (pattern: `components/customers/delete-customer-item.tsx`). Don't inline `<ConfirmDialog onConfirm={() => action(id)} />` in a `page.tsx`.
- UI primitives are the **Radix** shadcn preset (`asChild`, `Slot`). Don't use the Base UI `render` prop pattern.

## Auth and permissions

- The permission map lives in `lib/auth/permissions.ts` (`ADMIN` = all, `EMPLOYEE` = subset). Check permissions with `requireAuth` / `requirePermission` from `lib/auth/session.ts`; they throw `AuthenticationError` / `AuthorizationError`.
- API routes wrap handlers in `try` and return `toApiErrorResponse(err)` (`lib/auth/api.ts`): 401 / 403 / 400.
- `proxy.ts` only verifies the JWT. Every page, action and API handler must still check permissions on the server. Hiding UI is never the protection.
- Project timers are **owner-only**: only the user who started a running entry can pause or stop it, with no admin override (`lib/services/projects.ts`).
- The `jwt` callback in `auth.ts` re-reads role and status every 60 s; deactivated users lose access without logging out.
- Full matrix: `docs/AUTHORIZATION.md`.

## Money

- All amounts are **integer paise** (`*Paise` columns). All currency math goes through `lib/money.ts`:
  - `rupeesToPaise`, `applyPercent`, `sumPaise`;
  - `computeLineItem`, `computeDocumentTotals`, `computeFlatRateTotals`;
  - `formatCurrency` for display.
- Document totals convention: `subtotal` is after discount and before tax; `total = subtotal + tax + shipping`.
- Totals are recomputed on the server (quotations, invoices, orders). Never trust totals posted by a form.

## Database

- PostgreSQL (Neon) via Prisma 6. Change the schema with `npm run db:push`. **Never** `prisma migrate` — `prisma/migrations/` is a stale SQLite leftover.
- On Windows, stop `npm run dev` before `db push` or `prisma generate` (the engine DLL is locked).
- Don't add `pgbouncer=true` to `DATABASE_URL`.
- `Customer.notes` is a text column; the relation is `notesList`.
- `Invoice.amountPaidPaise` is changed only by `lib/services/payments.ts`.
- Details: `docs/DATABASE.md`.

## Business rules to preserve

- **Invoice status:** the stored status changes only on explicit events. `OVERDUE` is derived by `deriveInvoiceStatus()`; display and filter on `effectiveStatus`.
- **Quotations:** only `ACCEPTED` ones convert, once to an invoice (→ `CONVERTED`, invoice becomes non-editable) and once to an order (status unchanged). Only `DRAFT` can be deleted.
- **Payments:** amount ≤ outstanding, inside a Serializable transaction with one retry on `P2034`. Recording or deleting posts or reverses a journal entry.
- **Orders:** one GST rate (`CompanySettings.defaultGstRate`) via `computeFlatRateTotals()`; one production job per line is created automatically.
- **Revenue:** the dashboard is cash-based, current month (sum of payments). Finance and Reports are journal-based (`POSTED` entries only).
- **Accounting:** journal entries must balance and are corrected only by reversal. Auto-accounting is skipped until the chart of accounts exists.
- Full rules and known gaps: `docs/BUSINESS-LOGIC.md`.

## Documents

- Quotation and invoice use one template: `components/documents/document-preview.tsx`. Keep the order header → from/bill-to → items → totals → bottom block (notes/terms, then bank details/footer inside `data-pdf-anchor-bottom`).
- New blocks must be direct children of the container (or of the bottom wrapper) so `lib/pdf/exporter.ts` can break pages between them. Keep `prevent-break` on blocks that must not split in print.
- Details: `docs/DOCUMENTS.md`.

## Verify before finishing

```bash
npx tsc --noEmit                         # must pass
npx eslint <files you changed>           # no new errors (the repo has older ones)
npm run build                            # before anything ships
npx tsx scripts/test-flow.ts             # after quotation/invoice/payment/money changes
npx tsx scripts/test-project-timer.ts    # after project/timer changes
```

- The scripts write to the database in `.env`; prefer a Neon branch.
- `scripts/test-accounting-phase4.ts` doesn't clean up — throwaway databases only.
- For UI changes, run `npm run dev` and check the page in a browser.
- See `docs/TESTING.md`.

## DO NOT

- Don't do money math with floating-point rupees or outside `lib/money.ts`.
- Don't skip `requirePermission` in a Server Action or API route, or rely on hidden buttons for security.
- Don't query Prisma from pages or components; add a service function.
- Don't run `prisma migrate`, and don't hand-edit `prisma/migrations/`.
- Don't persist `OVERDUE`, or display the raw invoice `status` instead of `effectiveStatus`.
- Don't pass functions or components from Server to Client Components.
- Don't edit inside the `nextjs-agent-rules` markers in `AGENTS.md`, and don't create `middleware.ts` (Next 16 uses `proxy.ts`).
- Don't change UI, routes, permissions or business behaviour beyond what the task asks. Report unrelated problems instead of fixing them silently.

## Reference

`docs/ARCHITECTURE.md` · `docs/MODULES.md` · `docs/BUSINESS-LOGIC.md` · `docs/DATABASE.md` · `docs/AUTHORIZATION.md` · `docs/DOCUMENTS.md` · `docs/PROJECTS.md` · `docs/DEVELOPMENT.md` · `docs/TESTING.md` · `docs/DEPLOYMENT.md` · `docs/TROUBLESHOOTING.md`
