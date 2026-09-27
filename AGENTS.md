<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent Guide — Priinteve Business OS

A guide for any AI coding agent working in this repository. The block above is managed by `next dev`: leave it exactly as it is, and edit only below it.

**Project:** internal admin panel for a printing/design business — sales, production, planning, projects with time tracking, and double-entry accounting. Next.js 16 App Router, React 19, TypeScript, Prisma 6 on PostgreSQL (Neon), Auth.js v5. Overview: [README.md](./README.md). Detailed docs: [`docs/`](./docs/).

## Where things live

| To change… | Look in |
|---|---|
| A page or its layout | `app/(app)/<module>/` (`page.tsx`, `[id]/page.tsx`, `new/`, `[id]/edit/`, `layout.tsx`) |
| A business rule or query | `lib/services/<module>.ts` (accounting: `lib/services/accounting/`) |
| What a form submits and who may submit it | `lib/actions/<module>.ts` |
| Form validation and defaults | `lib/validations/<module>.ts` |
| Who can do what | `lib/auth/permissions.ts`; helpers in `lib/auth/session.ts` |
| Sign-in and sessions | `auth.ts`, `proxy.ts`, `types/next-auth.d.ts` |
| Currency math | `lib/money.ts` |
| Data model | `prisma/schema.prisma` |
| Sidebar and quick actions | `lib/nav-config.tsx` |
| Quotation/invoice layout, print, PDF | `components/documents/`, `app/globals.css` (print section), `lib/pdf/exporter.ts` |
| Module UI | `components/<module>/` (user forms are in `features/users/`) |
| Shared UI | `components/shared/`, `components/ui/` (shadcn) |
| JSON API | `app/api/` |
| Verification scripts | `scripts/` |

The full directory map is in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#directory-layout).

## How to inspect the codebase

1. **Read the doc for the area first:** [MODULES.md](./docs/MODULES.md) to find the files, then [BUSINESS-LOGIC.md](./docs/BUSINESS-LOGIC.md), [AUTHORIZATION.md](./docs/AUTHORIZATION.md) or [DATABASE.md](./docs/DATABASE.md) as needed.
2. **Follow one request end to end:**
   - the `page.tsx`;
   - the Client Component it renders;
   - the Server Action that component calls;
   - the service function;
   - the Prisma models in `schema.prisma`.
3. **Check permissions:** find the `requirePermission("…")` in the action or page, and look it up in `lib/auth/permissions.ts`.
4. **Find existing patterns before writing new code:**
   - `grep` for a similar action or service (every module follows the same shape);
   - reuse `components/shared/*`.
5. **Check Next.js APIs** in `node_modules/next/dist/docs/` before using them. This is Next.js 16: Middleware is now `proxy.ts`, Turbopack is the default, and route props are typed with the generated `PageProps` / `LayoutProps`.
6. **Treat the code as the source of truth.** If a doc disagrees with the code, trust the code and fix the doc.

## Development workflow

- Setup, environment variables and commands: [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).
- The database in `.env` may be a shared or real one. Ask before running anything that writes data you didn't create, and prefer a Neon branch for experiments.
- Schema changes: edit `prisma/schema.prisma`, stop the dev server (Windows), run `npm run db:push`. Never use `prisma migrate`.
- `npm run dev` re-writes the managed block at the top of this file if it has been changed.

## Modification rules

- **Keep changes minimal and in scope.** Don't change UI, routes, permissions, workflows or business behaviour unless the task asks for it. Report unrelated bugs instead of silently fixing them.
- **Follow the existing layering:**
  - Server Component page → Client Component → Server Action (`requirePermission` → Zod → service → `revalidatePath`) → service → Prisma.
  - Details in [ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- **Reuse before creating:** check `lib/services`, `lib/validations`, `components/shared` and `lib/money.ts` for an existing helper.
- **Keep the style consistent** with the surrounding code: naming, comment density, error messages written for end users.
- **No new dependencies** unless there's no reasonable alternative. Say why if you add one.
- **Keep money in integer paise**, and compute totals on the server.
- **Keep the project's gotchas in mind:** [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md).

## Testing requirements

There is no unit-test framework. Before calling a change done:

| Changed | Run |
|---|---|
| Anything in TypeScript | `npx tsc --noEmit` — must pass |
| Any file | `npx eslint <changed files>` — no new errors (the repo has older lint errors; don't add to them) |
| Anything that ships | `npm run build` — must pass |
| Quotations, invoices, payments, money math, numbering, dashboard | `npx tsx scripts/test-flow.ts` |
| Projects or timers | `npx tsx scripts/test-project-timer.ts` |
| Accounting or reports | `scripts/test-accounting-phase4.ts` — **throwaway database only**; it doesn't clean up |
| UI | Run `npm run dev` and check the affected page in a browser, as both Admin and Employee if permissions are involved |

Report honestly what you ran and what failed. Details: [docs/TESTING.md](./docs/TESTING.md).

## Security requirements

- **Authorize on the server, every time.** Every Server Action and API handler calls `requirePermission()` (or `requireAuth()`) before any work. Page gates and hidden buttons are not security.
- **Validate all input** with Zod before it reaches a service.
- **Keep ownership rules:** project timers are owner-only for pause/stop ([PROJECTS.md](./docs/PROJECTS.md#timer-ownership)).
- **No secrets in code or docs.** `.env` is git-ignored; only `.env.example` with placeholders is tracked. Never print or log `AUTH_SECRET`, connection strings, password hashes, or customer financial data unnecessarily.
- **Passwords** are hashed with bcrypt in `lib/services/users.ts`; never select or return `passwordHash`.
- **Don't weaken `proxy.ts` or `auth.ts`** (public paths, JWT verification, the status/role re-check).
- **Use Prisma's query API**, not string-built SQL.
- Known open security issues are listed in [docs/AUTHORIZATION.md — Other security notes](./docs/AUTHORIZATION.md#other-security-notes).

## Documentation requirements

- Update the matching file in `docs/` in the same change when you alter behaviour, a business rule, a permission, the schema, a command, or a known issue.
- Document only what the code does. Don't describe planned features as existing.
- Which file covers what: the table in [README.md](./README.md#documentation). Keep that index and the links between docs working.
- Put Claude-specific rules in `CLAUDE.md`, and agent-neutral guidance in this file (below the managed block).

## Things to avoid

- Running `prisma migrate` or editing `prisma/migrations/`.
- Running `scripts/test-accounting-phase4.ts` or `prisma/seed-realistic.ts` against a database that matters.
- Committing `.env`, generated files (`.next/`, `node_modules/`), or credentials.
- Adding `pgbouncer=true` to `DATABASE_URL`.
- Creating `middleware.ts`; the request guard is `proxy.ts`.
- Querying Prisma from pages or components.
- Floating-point rupee arithmetic.
- Persisting a derived status (invoice `OVERDUE`).
- Passing closures or components as props from Server to Client Components.
- Mixing Base UI (`render` prop) patterns into the Radix-based shadcn components.
- Deleting or reformatting code you weren't asked to touch.

## Conventions

| Item | Convention | Example |
|---|---|---|
| File names | kebab-case | `delete-customer-item.tsx` |
| Imports | `@/` path alias from the repo root | `import { prisma } from "@/lib/prisma"` |
| Service functions | `listX`, `getXDetail`, `createX`, `updateX`, `deleteX` | `listInvoices`, `getInvoiceDetail` |
| Server Actions | `<verb><Entity>Action`, return `FormActionResult` or `{ success, message }` | `createInvoiceAction` |
| Permissions | `module:action` | `invoices:create` |
| Money fields | `…Paise`, integer | `totalPaise` |
| Document numbers | `PREFIX-YEAR-NNNN` from `issueDocumentNumber()` | `INV-2026-0001` |
| Activity types | mostly `entity.event`; project events are upper-case | `invoice.created`, `TIMER_STARTED` |
| Forms | react-hook-form + `zodResolver`, schemas and defaults in `lib/validations` | `invoiceFormSchema`, `invoiceFormDefaults()` |
| Feedback | `sonner` toasts on the client | `toast.success(...)` |
| Dates | `date-fns`; helpers in `lib/format.ts`, `lib/time-format.ts` | `formatDate()` |
| Pages | async Server Components with `export const dynamic = "force-dynamic"` | every `app/(app)/**/page.tsx` |
