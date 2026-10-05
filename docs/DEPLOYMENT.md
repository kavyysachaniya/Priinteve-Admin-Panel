# Deployment

What a production deployment needs. Only what can be verified from the repository or the Vercel project settings is stated as fact; anything else is marked as an assumption.

Related: [DEVELOPMENT.md](./DEVELOPMENT.md) · [DATABASE.md](./DATABASE.md) · [AUTHORIZATION.md](./AUTHORIZATION.md) · [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Current setup

| Item | Value |
|---|---|
| Hosting platform | Vercel, project `priinteve-admin-panel` (verified in the Vercel project settings; there is no `vercel.json` or `vercel.ts` in the repo) |
| Git integration | GitHub `kavyysachaniya/Priinteve-Admin-Panel`; production branch `main`. Every push to `main` deploys to production; other branches create Preview deployments. |
| Build command (set in Vercel) | `npx prisma db push && next build`. It applies the schema to the database in `DATABASE_URL`/`DIRECT_URL` and regenerates the Prisma client on every build. |
| Build command (`package.json`) | `npm run build` → `next build` (Turbopack) |
| Start command | `npm start` → `next start` (port 3000 unless `PORT` is set) |
| Node.js | ≥ 20.9.0 |
| Database | PostgreSQL on Neon |
| Background jobs, cron, queues | None |
| File storage | AWS S3 for task attachments and the companion installer, when the `AWS_*` S3 variables are set ([STORAGE.md](./STORAGE.md)) |

## Environment variables

Set these on the host. Never commit real values; `.env.example` holds placeholders only. On Vercel, Production currently has `DATABASE_URL`, `DIRECT_URL` and `AUTH_SECRET`; Preview has only `DIRECT_URL` and `AUTH_SECRET`.

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Neon **pooled** URL with `sslmode=require&connect_timeout=10&connection_limit=10&pool_timeout=10`. **No `pgbouncer=true`.** |
| `DIRECT_URL` | Neon **direct** URL. Needed wherever you run `prisma db push`. |
| `AUTH_SECRET` | A strong random secret, different from development. Rotating it signs everyone out. |
| `NEXTAUTH_URL` | The public HTTPS URL of the app. Optional on Vercel, where it isn't currently set (Auth.js uses the request host); set it on other hosts. |
| `AUTH_TRUST_HOST` | `true` on **non-Vercel** hosts. |
| `APP_URL`, `COMPANION_ENCRYPTION_KEY`, `SLACK_BOT_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Desktop companion, all optional. Each integration switches on when its variables are set. See [COMPANION.md](./COMPANION.md#1-environment-variables). **Don't change `COMPANION_ENCRYPTION_KEY` once set**: stored Gmail tokens become unreadable. |
| `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | File storage for task attachments and the companion installer. The bucket needs CORS (including `PUT`) for the panel origin. See [STORAGE.md](./STORAGE.md). |

Why `AUTH_TRUST_HOST`: Auth.js v5 trusts the request host only if one of `AUTH_URL`, `AUTH_TRUST_HOST`, `VERCEL` or `CF_PAGES` is set, or `NODE_ENV` isn't `production` (`node_modules/@auth/core/lib/utils/env.js`). `NEXTAUTH_URL` alone does not count. Vercel sets `VERCEL` automatically; other hosts need `AUTH_TRUST_HOST=true` (or `AUTH_URL`), otherwise Auth.js rejects requests with an "UntrustedHost" error.

## Database

- **Runtime** connects through the pooled URL. `connection_limit=10` caps connections per server instance.
- **Schema changes** are applied with `prisma db push` against the production database, using `DIRECT_URL`. There are no migrations to deploy.
  - Run it whenever `prisma/schema.prisma` changes, **before** the new code goes live if the code depends on new columns.
  - `db push` refuses destructive changes unless told to accept data loss. Rehearse on a Neon branch first.
- **First deployment:** after the first `db push`, run `npm run db:seed` once against the production database to create expense categories, numbering sequences and the first users. Then change the seeded passwords and fill in **Settings**.
- **Neon behaviour:** idle pooled connections are closed and the compute suspends after about 5 minutes. The first request afterwards is slower while it wakes. `TX_OPTIONS` (15 s wait, 30 s timeout) allows for this, and the resulting connection-reset log lines are filtered ([TROUBLESHOOTING.md](./TROUBLESHOOTING.md#neon-idle-disconnect-errors-in-the-terminal)).
- **Latency:** every page runs several queries. Put the app and the Neon database in the same or nearby regions.

## Prisma client generation

On Vercel the build command runs `prisma db push` first, which also regenerates the Prisma client, so a stale client isn't a concern there. `npm run build` on its own does not run `prisma generate`; the client comes from `@prisma/client`'s install step or from `db push`.

## Preview deployments

Preview builds (any branch other than `main`) run the same build command, but `DATABASE_URL` is set only for **Production** in Vercel. Preview builds therefore fail with `P1012: Environment variable not found: DATABASE_URL`. That is expected with the current setup.

If you enable previews, don't just copy the production `DATABASE_URL` into Preview: the build's `prisma db push` would then change the production database from a branch. Point Preview at a separate Neon branch instead.

## Deployment workflow

1. Run the checks locally ([TESTING.md](./TESTING.md)): `npx tsc --noEmit`, lint on changed files, `npm run build`, and the relevant `scripts/test-*.ts`.
2. If the schema changed, run `npm run db:push` against a Neon branch, then against production.
3. Make sure the host's environment variables match [the table above](#environment-variables).
4. Build and deploy (`npm run build`, then `npm start`, or the host's equivalent).
5. Smoke-test in the deployed app:
   - sign in and open a few pages;
   - open an invoice and use Print and Download PDF;
   - as an Employee, confirm that `/settings` redirects to `/dashboard`.

## Production configuration notes

- **Sessions** are JWT cookies that expire after 30 days idle. Role and status are re-checked about once a minute ([AUTHORIZATION.md](./AUTHORIZATION.md#session-validation)).
- **Logging:** services log failures with `console.error`, and Prisma errors are printed as `prisma:error ...`. Neon idle-disconnect messages are dropped.
- **Caching:** every app page and API route is `force-dynamic`; nothing is statically cached.
- **Calendar feed:** `/api/calendar/feed` requires a signed-in session, so external calendar subscriptions don't receive data ([MODULES.md](./MODULES.md#calendar)).

## Common deployment problems

| Symptom | Cause | Fix |
|---|---|---|
| Preview build fails with `P1012 … DATABASE_URL` | `DATABASE_URL` is set only for Production | Expected; see [Preview deployments](#preview-deployments) |
| Auth error "UntrustedHost" | Non-Vercel host without `AUTH_TRUST_HOST`/`AUTH_URL` | Set `AUTH_TRUST_HOST=true` |
| Everyone was signed out | `AUTH_SECRET` changed | Expected; keep it stable |
| Slow pages or "Timed out fetching a new connection from the connection pool" | `pgbouncer=true` in `DATABASE_URL`, or the app and database are far apart | Remove the flag; co-locate regions |
| `prisma db push` fails or wants to drop data | Destructive schema change | Rehearse on a Neon branch; migrate data manually first |
| "A record with these details already exists." when saving expenses on a demo database | `seed-realistic.ts` numbering collision | See [DATABASE.md](./DATABASE.md#gotchas) |
