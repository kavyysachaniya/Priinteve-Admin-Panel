import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across hot reloads in dev so we don't
// exhaust database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Standard transaction configuration for Neon serverless auto-wake resilience */
export const TX_OPTIONS = {
  maxWait: 10000, // 10s wait for connection (handles Neon compute node cold-starts)
  timeout: 15000, // 15s execution timeout
};

