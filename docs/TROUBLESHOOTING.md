# Troubleshooting

Problems that are known to happen in this project, with their cause and fix. Each entry is based on the current code or on issues hit while building it.

Related: [DEVELOPMENT.md](./DEVELOPMENT.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [DATABASE.md](./DATABASE.md)

---

## Database and Prisma

### Neon idle-disconnect errors in the terminal

**Symptom:** `prisma:error Error in PostgreSQL connection: Error { kind: Io, cause: Some(Os { code: 10054, kind: ConnectionReset, ... }) }` or `... kind: Closed ...` in the dev server output.

**Cause:** Neon closes pooled connections that sit idle, and suspends compute after about 5 minutes. Prisma logs each closed connection, then reconnects on the next query. Nothing fails.

**Fix:** none needed. `lib/prisma.ts` drops exactly these messages (OS codes 10054, 104, 10053, and `kind: Closed`) and prints every other Prisma error. Setting `max_idle_connection_lifetime` does not stop them: it's checked only when a connection is taken from the pool, not when Neon closes it.

### Slow pages or "Timed out fetching a new connection from the connection pool"

**Cause:** usually `pgbouncer=true` in `DATABASE_URL`. It makes Prisma use extra round trips for every query (measured at about 2 s versus 0.4 s for a simple `SELECT 1`). Queries then hold connections longer, and the pool (`connection_limit=10`, `pool_timeout=10`) runs out. The remaining latency comes from the distance between the app and the Neon region.

**Fix:** remove `pgbouncer=true`; Neon's pooler supports prepared statements. Keep the parameters from `.env.example`, and run the app close to the database's region.

### `EPERM` or "file is locked" on `prisma db push` / `prisma generate` (Windows)

**Cause:** the running dev server holds Prisma's query-engine DLL open.

**Fix:** stop `npm run dev`, run the command, then start the server again.

### `prisma migrate` fails or reports drift

**Cause:** `prisma/migrations/` is from the old SQLite setup (`migration_lock.toml` says `sqlite`). The database is managed with `db push`.

**Fix:** don't use `prisma migrate`. Use `npm run db:push`.

### "A record with these details already exists." when saving

**Cause:** `friendlyError()` shows this for any Prisma unique-constraint error (`P2002`). Common cases:

- a duplicate user email;
- a duplicate account code;
- a duplicate document number after running `prisma/seed-realistic.ts`, which inserts `EXP-2026-0001`/`0002` without advancing the expense sequence.

**Fix:** for the numbering case, retry — each failed attempt advances the sequence — or raise `nextNumber` for the `expense` row in `NumberingSequence` with Prisma Studio.

### `Customer.notes` query errors

**Cause:** on `Customer`, `notes` is a plain text column. The relation to `Note` is called `notesList`. Selecting `notes: { ... }` fails with a Prisma validation error.

**Fix:** use `notesList` for the relation.

### Reports, ledger or GST page are empty although invoices and payments exist

**Cause:** auto-accounting posts nothing until the chart of accounts exists, and it's created the first time someone opens `/accounts`. Entries skipped before that are never back-filled. Invoices also post their journal entry only when **marked Sent**.

**Fix:** open `/accounts` as an Admin once, then mark invoices as Sent. See [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#chart-of-accounts).

## Next.js

### A page shows stale data that never updates

**Cause:** a page with no dynamic input (no `searchParams`, cookies or params) gets rendered once at build time.

**Fix:** every page in this app exports `export const dynamic = "force-dynamic"`. Add it to any new page.

### "Functions cannot be passed directly to Client Components"

**Cause:** a Server Component passed a closure, an event handler or a component reference (for example a Lucide icon) as a prop to a Client Component.

**Fix:** pass only serializable data or Server Action references. Put interactive logic in a small Client Component that takes an `id` and builds its own handlers (see `components/customers/delete-customer-item.tsx`). The sidebar imports `NAV_SECTIONS` (with icons) inside the Client Component instead of receiving it as a prop.

### `middleware.ts` has no effect

**Cause:** Next.js 16 renamed Middleware to **Proxy**. This project's request guard is `proxy.ts`, exporting `proxy`.

**Fix:** edit `proxy.ts`; don't add a `middleware.ts`.

### `AGENTS.md` changes keep reappearing

**Cause:** `next dev` rewrites the block between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` if it's missing or different.

**Fix:** leave that block exactly as generated and commit it. Edit only outside the markers.

## UI components

### A shadcn component copied from the docs doesn't work

**Cause:** this project uses the **Radix-based** shadcn preset (`"style": "radix-nova"` in `components.json`; `components/ui/*` import from `radix-ui`). Examples for the newer Base UI preset use a `render` prop instead of `asChild`.

**Fix:** use the Radix patterns (`asChild`, `Slot`). Add components with the shadcn CLI so they match `components.json`.

### An Employee sees a Delete (or other) button, but the action fails

**Cause:** by design, pages don't hide action buttons by role; the Server Action checks the permission ([AUTHORIZATION.md](./AUTHORIZATION.md#three-layers-of-protection)). The check throws, so the client shows an error.

**Fix:** none needed for security. If you want to hide the button, check the permission on the server and pass a boolean to the Client Component. Keep the server-side check.

## Authentication

### "UntrustedHost" error from Auth.js

**Cause:** production on a non-Vercel host without `AUTH_TRUST_HOST` or `AUTH_URL`.

**Fix:** set `AUTH_TRUST_HOST=true`.

### Signed out unexpectedly

Possible causes:

- The account was deactivated, deleted or changed. This takes effect within about a minute.
- `AUTH_SECRET` changed. This invalidates every session.
- The session was idle for 30 days.

### Login always fails with correct credentials

**Cause:** the user is `INACTIVE`, or the database was unreachable. `authorize()` returns "invalid credentials" for any error.

**Fix:** check the user's status at `/users` and check the database connection in the server logs.

## Documents and PDF

### The downloaded PDF's text can't be selected or searched

**Cause:** Download PDF saves an image of the page (`html-to-image` → jsPDF).

**Fix:** use **Print** → "Save as PDF" for a text PDF.

### A one-page invoice downloads as two pages

**Cause:** the export follows the on-screen width. In a window narrower than the A4 preview (210 mm), the image is scaled up to A4 width and becomes taller than one page.

**Fix:** widen the window until the full preview is visible, then download again.

### Quotations have no Print / Download PDF button

**Cause:** only the invoice page renders those buttons.

**Fix:** on a quotation, use the browser's print (Ctrl+P / ⌘P). The print CSS hides the app chrome.

### Bank Details don't appear on documents

**Cause:** the block is rendered only when Settings has a bank name or an account number.

**Fix:** fill in the bank details in Settings.

### New quotations don't include the default terms from Settings

**Cause:** known gap — `quotationTerms` isn't applied anywhere ([BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#known-gaps)).

**Fix:** type the terms on the quotation form.

## Data looks wrong

| Symptom | Cause |
|---|---|
| Dashboard revenue ≠ Finance overview revenue | Dashboard is cash received this month; Finance is posted journal income, year to date ([revenue recognition](./BUSINESS-LOGIC.md#revenue-recognition)) |
| An invoice shows "Overdue" but the `status` column says `SENT` | Overdue is derived at read time |
| Search doesn't find a record typed in different capitals | Most list searches are case-sensitive; Projects and Journal are not |
| An order went back to `IN_PRODUCTION` or `READY` | A production job's stage changed; that always resyncs the order status |
| Dashboard "Outstanding" is higher than the Receivables page | The dashboard includes draft invoices; Receivables doesn't |
| Payables shows expenses that were already paid | Every recorded expense with a vendor is listed as outstanding; nothing marks it paid |

## Calendar

### Google Calendar subscription shows no events

**Cause:** `/api/calendar/feed` sits behind `proxy.ts`, which requires a signed-in session cookie. Google's servers don't have one and are redirected to `/login`.

### Event times are off by several hours in Google Calendar

**Cause:** the feed and the "add to Google Calendar" links write the entered times with a `Z` suffix, which marks them as UTC.

## Verification scripts

### `test-flow.ts` refuses to clean up

The message says either:

- a test journal entry falls in a **closed accounting period** — reopen the period at `/accounting/periods`, or delete the test records by hand; or
- a test customer **has orders** — the script never creates orders, so someone used the test customer. Remove those orders first.

### `test-project-timer.ts` left test data behind

It cleans up only when every step passes. Delete the projects "Brand Identity Redesign" and "Product Packaging Design" and the customer "Acme Corp Design Client" that the failed run created. Check dates and time entries first; a real project may have the same name.
