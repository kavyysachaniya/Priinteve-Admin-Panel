import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across hot reloads in dev so we don't
// exhaust database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Neon closes pooled connections that sit idle (and suspends compute after ~5 min). Prisma's
// engine logs each one as "Error in PostgreSQL connection ... Closed / ConnectionReset (10054)",
// but it transparently reconnects on the next query, so nothing actually fails. Drop just that
// message; every other engine/query error is still printed.
const IDLE_DISCONNECT = /^Error in PostgreSQL connection: Error \{ kind: (Closed|Io, cause: Some\(Os \{ code: (10054|104|10053)\b)/;

function createClient() {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      ...(process.env.NODE_ENV === "development" ? [{ emit: "stdout" as const, level: "warn" as const }] : []),
    ],
  });
  client.$on("error", (e) => {
    if (IDLE_DISCONNECT.test(e.message)) return;
    console.error("prisma:error", e.message);
  });
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Standard transaction configuration for Neon serverless auto-wake resilience */
export const TX_OPTIONS = {
  maxWait: 15000, // 15s wait for connection (handles Neon compute node cold-starts)
  timeout: 30000, // 30s execution timeout
};
