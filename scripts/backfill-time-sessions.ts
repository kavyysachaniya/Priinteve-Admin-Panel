/**
 * One-off, idempotent: gives every time entry written before work sessions existed its own
 * session (sessionId = id) and checks that the one-active-timer partial index is present.
 *
 *   npx tsx scripts/backfill-time-sessions.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const updated = await prisma.$executeRaw`
    UPDATE "ProjectTimeEntry" SET "sessionId" = "id" WHERE "sessionId" IS NULL`;
  console.log(`Backfilled sessionId on ${updated} time entr${updated === 1 ? "y" : "ies"}.`);

  const index = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'ProjectTimeEntry' AND indexname = 'ProjectTimeEntry_one_active_per_user'`;
  if (index.length === 0) {
    console.error("Missing index ProjectTimeEntry_one_active_per_user. Run `npm run db:index`.");
    process.exitCode = 1;
  } else {
    console.log("One-active-timer index present.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
