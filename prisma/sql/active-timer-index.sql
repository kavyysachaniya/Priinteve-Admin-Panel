-- Prisma cannot express partial indexes. Re-apply after `db push` if it is dropped.
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTimeEntry_one_active_per_user"
ON "ProjectTimeEntry" ("userId")
WHERE "endedAt" IS NULL AND "userId" IS NOT NULL;
