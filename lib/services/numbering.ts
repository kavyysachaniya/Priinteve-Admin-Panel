import { prisma, TX_OPTIONS } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type SequenceKey = "quotation" | "invoice" | "order" | "production" | "delivery" | "expense" | "journal";

const DEFAULTS: Record<SequenceKey, { prefix: string }> = {
  quotation: { prefix: "QTN" },
  invoice: { prefix: "INV" },
  order: { prefix: "ORD" },
  production: { prefix: "PROD" },
  delivery: { prefix: "DEL" },
  expense: { prefix: "EXP" },
  journal: { prefix: "JE" },
};

function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

/**
 * Atomically issues the next document number for the given key, formatted as `PREFIX-YEAR-0001`.
 * Must be called inside a `prisma.$transaction` alongside the document insert so numbers are never skipped.
 */
export async function issueDocumentNumber(
  tx: TxClient | Prisma.TransactionClient,
  key: SequenceKey
): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await tx.numberingSequence.findUnique({ where: { key } });

  if (!existing) {
    await tx.numberingSequence.create({
      data: { key, prefix: DEFAULTS[key].prefix, year, nextNumber: 2, padding: 4 },
    });
    return `${DEFAULTS[key].prefix}-${year}-${pad(1, 4)}`;
  }

  const currentYear = existing.year === year ? year : year;
  const startNumber = existing.year === year ? existing.nextNumber : 1;

  await tx.numberingSequence.update({
    where: { key },
    data: { year: currentYear, nextNumber: startNumber + 1 },
  });

  return `${existing.prefix}-${currentYear}-${pad(startNumber, existing.padding)}`;
}

/** For Settings — shows current prefix and next number for each document type. */
export async function getNumberingSequences() {
  const year = new Date().getFullYear();
  const keys: SequenceKey[] = ["quotation", "invoice", "order", "production", "delivery", "expense"];

  return Promise.all(
    keys.map(async (key) => {
      const existing = await prisma.numberingSequence.findUnique({ where: { key } });
      if (existing) return existing;
      return prisma.numberingSequence.create({
        data: { key, prefix: DEFAULTS[key].prefix, year, nextNumber: 1, padding: 4 },
      });
    })
  );
}

export async function updateSequencePrefix(key: SequenceKey, prefix: string) {
  const cleanPrefix = prefix.trim().toUpperCase();
  if (!cleanPrefix) throw new Error("Prefix can't be empty");
  const year = new Date().getFullYear();
  return prisma.numberingSequence.upsert({
    where: { key },
    update: { prefix: cleanPrefix },
    create: { key, prefix: cleanPrefix, year, nextNumber: 1, padding: 4 },
  });
}

export async function generateOrderNumber() {
  return prisma.$transaction((tx) => issueDocumentNumber(tx, "order"), TX_OPTIONS);
}

export async function generateExpenseNumber() {
  return prisma.$transaction((tx) => issueDocumentNumber(tx, "expense"), TX_OPTIONS);
}

export async function generateProductionNumber() {
  return prisma.$transaction((tx) => issueDocumentNumber(tx, "production"), TX_OPTIONS);
}

export async function generateDeliveryNumber() {
  return prisma.$transaction((tx) => issueDocumentNumber(tx, "delivery"), TX_OPTIONS);
}
