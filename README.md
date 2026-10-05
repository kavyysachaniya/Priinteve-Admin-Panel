# Priinteve Business OS

Internal admin panel for **Priinteve**, a printing, design and digital-services business. One system for sales, production, planning and accounting:

```text
Customer → Quotation → Accepted → Invoice / Order → Payment → Accounts
```

Staff sign in with an email and password. Admins can do everything; Employees have a restricted set of permissions (see [docs/AUTHORIZATION.md](./docs/AUTHORIZATION.md)).

## Modules

| Area | Modules |
|---|---|
| Overview | Dashboard, Projects (with live per-user time tracking) |
| Sales | Customers, Products & Services, Quotations, Orders, Invoices, Payments |
| Operations | Production, Deliveries |
| Planner | Planner, Calendar (with iCal feed), Tasks, Notes |
| Finance & Accounts | Finance overview, Receivables, Payables, Tax (GST), Chart of accounts, Journal & ledger, Accounting periods, Reports (P&L, balance sheet, cash flow), Expenses, Vendors |
| Admin | Users, Settings (company details, bank details, document defaults, numbering) |

Details for each module: [docs/MODULES.md](./docs/MODULES.md).

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |
| UI | Tailwind CSS 4, shadcn/ui (Radix-based `radix-nova` style), lucide-react, next-themes, sonner, Recharts |
| Forms and validation | react-hook-form, Zod 4 |
| Data | PostgreSQL on Neon, Prisma 6 |
| Auth | Auth.js v5 (`next-auth` beta) with credentials and JWT sessions, bcryptjs |
| Documents | jsPDF with html-to-image (html2canvas fallback) |

## Architecture at a glance

- `app/(app)/*` — signed-in pages, rendered as Server Components that read data through `lib/services/*`.
- `lib/actions/*` — Server Actions for every change: permission check → Zod validation → service call.
- `lib/services/*` — all business rules and database access (Prisma).
- `proxy.ts` + `auth.ts` + `lib/auth/*` — sessions and role-based permissions, checked on the server for every page and action.
- `lib/money.ts` — all amounts are integer paise; no floating-point money math.

More: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Getting started

Requirements: Node.js ≥ 20.9 and a PostgreSQL database (the project uses Neon).

```bash
npm install
cp .env.example .env        # then fill in the values below
npm run db:push             # create the tables
npm run db:seed             # defaults and the first Admin/Employee accounts
npm run dev                 # http://localhost:3000
```

The seed creates one Admin and two Employee accounts, only if the database has no users yet. Their initial credentials are in `prisma/seed.ts`; change the passwords after first sign-in. Then:

- enter your company, bank, GST and terms details in **Settings**;
- open **Accounts** once to create the chart of accounts.

Full setup guide: [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (without `pgbouncer=true`) |
| `DIRECT_URL` | Neon direct connection string, used by Prisma for schema changes |
| `AUTH_SECRET` | Secret for session cookies |
| `NEXTAUTH_URL` | Base URL of the app |

`.env.example` has the expected format. Never commit `.env`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / run it |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database (**don't** use `prisma migrate`) |
| `npm run db:seed` | Seed defaults and first users |
| `npm run db:studio` | Browse the database |

## Testing

There is no unit-test suite. Changes are verified with type-checking, lint, a production build, and scripts that run the real business logic against a database:

```bash
npx tsx scripts/test-flow.ts            # quotation → invoice → payments → dashboard
npx tsx scripts/test-project-timer.ts   # project timers, including owner-only control
```

Run them against a Neon branch rather than production. What each script covers and cleans up: [docs/TESTING.md](./docs/TESTING.md).

## Production build and deployment

```bash
npm run build
npm start
```

Production runs on Vercel (project `priinteve-admin-panel`), which deploys every push to `main`. Its build command is `npx prisma db push && next build`, so schema changes are applied during the build. Details: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Layers, request flow, conventions, design decisions |
| [docs/MODULES.md](./docs/MODULES.md) | Every module's routes, components, services and models |
| [docs/BUSINESS-LOGIC.md](./docs/BUSINESS-LOGIC.md) | Money, statuses, conversions, payments, GST, accounting rules, known gaps |
| [docs/DATABASE.md](./docs/DATABASE.md) | Prisma schema, relationships, constraints, transactions |
| [docs/AUTHORIZATION.md](./docs/AUTHORIZATION.md) | Login, sessions, roles, permission matrix, route and action protection |
| [docs/DOCUMENTS.md](./docs/DOCUMENTS.md) | Quotation/invoice template, printing, PDF export |
| [docs/PROJECTS.md](./docs/PROJECTS.md) | Projects and time tracking |
| [docs/STORAGE.md](./docs/STORAGE.md) | AWS S3 file storage: task attachments, installer, bucket CORS and IAM |
| [docs/COMPANION.md](./docs/COMPANION.md) | Desktop Morning Companion: team guide, Slack/Google/Meta setup, installer |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Local setup, commands, adding features |
| [docs/TESTING.md](./docs/TESTING.md) | Verification scripts and manual checks |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Production requirements and workflow |
| [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Known problems and fixes |
| [AGENTS.md](./AGENTS.md) / [CLAUDE.md](./CLAUDE.md) | Instructions for AI coding agents |

## Project structure

```text
app/(auth)/          login page
app/(app)/           signed-in pages, one folder per module
app/api/             Auth.js, project timer API, iCal feed, companion briefing + OAuth
components/          UI by module; documents/ = quotation/invoice template; ui/ = shadcn
features/users/      user form and status toggle
lib/services/        business logic and database access
lib/actions/         Server Actions
lib/validations/     Zod schemas
lib/auth/            permissions and session helpers
lib/money.ts         currency math
lib/pdf/exporter.ts  PDF export
prisma/              schema and seed scripts
scripts/             verification scripts
docs/                project documentation
companion/           Windows desktop companion (Electron, separate package)
proxy.ts, auth.ts    request guard and Auth.js config
```
