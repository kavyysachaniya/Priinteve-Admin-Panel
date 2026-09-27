# Development

Setting up a local environment and the day-to-day commands.

Related: [DATABASE.md](./DATABASE.md) · [TESTING.md](./TESTING.md) · [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | **≥ 20.9.0** (required by Next.js 16.3.2); Node 22 is known to work | Runtime |
| npm | the version bundled with Node | The repo uses `package-lock.json` |
| PostgreSQL | A Neon project (pooled + direct connection strings) or any PostgreSQL database | Data |
| Git | any | |

No `.nvmrc` or `engines` field pins the Node version.

## Install

```bash
npm install
```

`@prisma/client`'s install step runs `prisma generate`. If Prisma model types are missing later, run `npx prisma generate`.

## Environment variables

Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored; never commit it.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string (host contains `-pooler`). Keep the parameters from `.env.example`: `sslmode=require&connect_timeout=10&connection_limit=10&pool_timeout=10`. Do **not** add `pgbouncer=true` — it makes every query 2–3× slower. |
| `DIRECT_URL` | yes | Neon **direct** connection string (no `-pooler`). The Prisma CLI uses it for `db push`. |
| `AUTH_SECRET` | yes | Signs and encrypts session cookies; `proxy.ts` also uses it. Generate one with the command below. Changing it signs everyone out. |
| `NEXTAUTH_URL` | yes | Base URL of the app — `http://localhost:3000` locally. |
| `AUTH_TRUST_HOST` | production, non-Vercel hosts only | See [DEPLOYMENT.md](./DEPLOYMENT.md#environment-variables). Not needed locally. |

Generate `AUTH_SECRET` (works in PowerShell and bash):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`NODE_ENV` is set by Next.js. In `development`, Prisma also prints warnings, and the Prisma client is reused across hot reloads.

## Database setup

```bash
npm run db:push   # create/update tables from prisma/schema.prisma
npm run db:seed   # defaults and first users
```

`npm run db:seed` runs `prisma/seed.ts` (through `ts-node`, configured under `"prisma"` in `package.json`). It:

1. upserts 8 expense categories;
2. creates a sample `CompanySettings` row **only if none exists** — replace the sample company and bank details in **Settings**;
3. creates numbering sequences for quotations, invoices, orders, production, deliveries and expenses if they're missing;
4. creates one Admin and two Employee accounts **only if the users table is empty**. Their emails and initial passwords are in `prisma/seed.ts` and printed by the seed; change them after first sign-in;
5. tries to import an old SQLite export from a hard-coded Windows path, and skips silently when the file isn't there.

It is safe to re-run.

After seeding:

- open **Settings** and enter the real company details, bank details, default GST rate and terms;
- open **Accounts** once (as Admin) — this creates the chart of accounts. Until then, invoices, payments and expenses post no journal entries ([BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md#chart-of-accounts)).

### Optional demo data

```bash
npx tsx prisma/seed-realistic.ts
```

It adds sample categories, products, customers, vendors and two expenses.

> [!WARNING]
> `seed-realistic.ts` is not idempotent: each run creates duplicate products, customers and vendors. Its hard-coded expense numbers also collide with the expense sequence — see [DATABASE.md](./DATABASE.md#gotchas). Use it only on an empty or throwaway database.

## Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. `/` redirects to `/dashboard`, and unauthenticated requests go to `/login`. Next.js 16 uses Turbopack for `dev` and `build` by default.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build (`next build`) |
| `npm start` | Serve the production build (`next start`) |
| `npm run lint` | ESLint (flat config in `eslint.config.mjs`: `next/core-web-vitals` + `next/typescript`; `prisma/**` ignored) |
| `npx tsc --noEmit` | Type-check |
| `npx next typegen` | Generate the route types (`PageProps`, `LayoutProps`) without a full build |
| `npm run db:push` | Apply the Prisma schema and regenerate the client |
| `npm run db:seed` | Seed defaults (above) |
| `npm run db:studio` | Prisma Studio |
| `npx prisma generate` | Regenerate the Prisma client only |
| `npx tsx scripts/<name>.ts` | Run a verification script ([TESTING.md](./TESTING.md)) |

> [!CAUTION]
> Don't run `prisma migrate`. See [DATABASE.md — Changing the schema](./DATABASE.md#changing-the-schema).

## Code generation

| What | How | Output |
|---|---|---|
| Prisma client and types | `npm run db:push`, `npx prisma generate`, or on install | `node_modules/.prisma/client` |
| Next.js route types (`PageProps<"/invoices/[id]">`, `LayoutProps<"/">`) | automatically during `next dev` / `next build`, or `npx next typegen` | `.next/types` |
| `AGENTS.md` Next.js rules block | re-added by `next dev` if missing or changed | `AGENTS.md` (between the `nextjs-agent-rules` markers) |

## Current state of the checks

As of 2026-09-27:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | passes |
| `npm run lint` | 38 errors, 68 warnings — all older code: mostly `@typescript-eslint/no-explicit-any` errors and unused-variable warnings. Don't add new ones. |
| `npm run build` | passes |

## Adding to a module

The existing modules all follow the same shape. To add a field or feature:

1. **Schema** — edit `prisma/schema.prisma`; money as `Int` paise. Run `npm run db:push`.
2. **Validation** — add or extend the Zod schema and defaults in `lib/validations/<module>.ts`.
3. **Service** — put all Prisma queries and business rules in `lib/services/<module>.ts`. Use a transaction with `TX_OPTIONS` for multi-step writes, and call `logActivity()` for notable events.
4. **Server Action** — in `lib/actions/<module>.ts`: `requirePermission(...)`, then `safeParse`, service call, `revalidatePath`, and return a `FormActionResult`.
5. **Permission** — if you need a new one, add it to `PERMISSIONS` in `lib/auth/permissions.ts` and, if Employees should have it, to `EMPLOYEE_PERMISSIONS`.
6. **Page** — add an async Server Component under `app/(app)/<module>/` with `export const dynamic = "force-dynamic"`. A new module folder also gets a gating `layout.tsx` (copy `app/(app)/customers/layout.tsx`) and a `loading.tsx`.
7. **Navigation** — add the item to `NAV_SECTIONS` in `lib/nav-config.tsx` with its `requiredPermission`.
8. **Client UI** — components in `components/<module>/`. Delete buttons are their own Client Component taking an `id`.
9. **Docs** — update the matching file in `docs/`.
10. **Verify** — type-check, lint the files you touched, build, and run the relevant scripts ([TESTING.md](./TESTING.md)).

## Windows notes

This project is developed on Windows.

- **Stop `npm run dev` before `prisma db push` or `prisma generate`.** The dev server keeps Prisma's query-engine DLL open, and the command fails with `EPERM`.
- The commands above work in PowerShell and Git Bash.
- `prisma/seed.ts` looks for an old SQLite export at a hard-coded `C:/Users/...` path. On other machines the file doesn't exist and the step is skipped.
