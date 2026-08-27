# Priinteve Business OS — Phase 1

Internal admin panel for Priinteve: customers, products & services,
quotations, invoices, payments, and a finance overview, all wired into one
connected flow —

```
Customer → Quotation → Accepted → Convert to Invoice → Payment → Revenue
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui · Lucide icons · Sonner · Tiptap · Prisma (SQLite) · Recharts

## Getting started

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db and applies the schema
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to
`/dashboard`. Company details, bank info, and document numbering are editable
at `/settings`.

## Verify the core business flow

```bash
npx tsx scripts/test-flow.ts
```

Runs the full spec'd flow end-to-end against the real service layer: creates
a customer and product, builds a quotation, accepts it, converts it to an
invoice, records a partial then final payment, and checks the invoice status,
outstanding balance, and dashboard/finance revenue all update correctly.

## Project structure

See [CLAUDE.md](./CLAUDE.md) for the architecture notes, business rules, and
gotchas worth knowing before touching this codebase.

## Database

Local SQLite for now (`prisma/dev.db`, gitignored). To move to a hosted
Postgres database for production, update the `datasource` block in
`prisma/schema.prisma` and set `DATABASE_URL` — the service layer
(`lib/services/*`) doesn't rely on SQLite-specific behavior.
