/**
 * Journal Entry service — Phase 4
 *
 * Implements strict double-entry accounting:
 * - Every posted journal entry must have SUM(debitPaise) == SUM(creditPaise) > 0
 * - Posted entries cannot be deleted or silently modified
 * - Corrections are made via reversal entries
 */

import { prisma } from "@/lib/prisma";
import { issueDocumentNumber } from "@/lib/services/numbering";
import type { JournalEntryStatus, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JournalLineInput {
  debitAccountId?: string | null;
  creditAccountId?: string | null;
  debitPaise: number;
  creditPaise: number;
  description?: string;
  sortOrder?: number;
}

export interface CreateJournalEntryInput {
  date: Date | string;
  description: string;
  reference?: string;
  sourceType?: string;
  invoiceId?: string;
  paymentId?: string;
  expenseId?: string;
  createdById?: string;
  lines: JournalLineInput[];
  autoPost?: boolean; // if true, immediately post the entry
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateJournalLines(lines: JournalLineInput[]) {
  if (!lines || lines.length < 2) {
    throw new Error("A journal entry must have at least 2 lines.");
  }

  let totalDebit  = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (line.debitPaise < 0 || line.creditPaise < 0) {
      throw new Error("Debit and credit amounts must be non-negative.");
    }
    if (line.debitPaise > 0 && line.creditPaise > 0) {
      throw new Error("A single journal line cannot have both a debit and a credit.");
    }
    if (!line.debitAccountId && !line.creditAccountId) {
      throw new Error("Each journal line must specify either a debit or credit account.");
    }
    totalDebit  += line.debitPaise;
    totalCredit += line.creditPaise;
  }

  if (totalDebit === 0 && totalCredit === 0) {
    throw new Error("Journal entry cannot be empty (all amounts are zero).");
  }

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Journal entry does not balance. Total Debits: ₹${(totalDebit / 100).toFixed(2)}, ` +
      `Total Credits: ₹${(totalCredit / 100).toFixed(2)}.`
    );
  }
}

// ---------------------------------------------------------------------------
// Create & Post
// ---------------------------------------------------------------------------

export async function createJournalEntry(
  data: CreateJournalEntryInput,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  validateJournalLines(data.lines);

  // Issue a journal number — must be done within the same transaction to be safe
  const number = await issueDocumentNumber(
    db as Parameters<typeof issueDocumentNumber>[0],
    "journal"
  );

  const entry = await db.journalEntry.create({
    data: {
      number,
      date: new Date(data.date),
      description: data.description,
      reference: data.reference || null,
      status: data.autoPost ? "POSTED" : "DRAFT",
      sourceType: data.sourceType || null,
      invoiceId: data.invoiceId || null,
      paymentId: data.paymentId || null,
      expenseId: data.expenseId || null,
      createdById: data.createdById || null,
      lines: {
        create: data.lines.map((line, idx) => ({
          debitAccountId:  line.debitPaise  > 0 ? (line.debitAccountId  || null) : null,
          creditAccountId: line.creditPaise > 0 ? (line.creditAccountId || null) : null,
          debitPaise:  line.debitPaise,
          creditPaise: line.creditPaise,
          description: line.description || null,
          sortOrder: line.sortOrder ?? idx,
        })),
      },
    },
    include: { lines: true },
  });

  return entry;
}

export async function postJournalEntry(id: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const entry = await db.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!entry) throw new Error("Journal entry not found.");
  if (entry.status === "POSTED") throw new Error("Entry is already posted.");
  if (entry.status === "VOID") throw new Error("Cannot post a voided entry.");

  validateJournalLines(
    entry.lines.map((l) => ({
      debitAccountId: l.debitAccountId,
      creditAccountId: l.creditAccountId,
      debitPaise: l.debitPaise,
      creditPaise: l.creditPaise,
    }))
  );

  return db.journalEntry.update({
    where: { id },
    data: { status: "POSTED" },
  });
}

/**
 * Reverse a posted journal entry by creating a new journal entry that mirrors
 * it with debits/credits swapped. The original entry is NOT deleted — both
 * entries remain in the ledger for auditability.
 */
export async function reverseJournalEntry(
  id: string,
  opts: { date?: Date; description?: string; createdById?: string; tx?: Prisma.TransactionClient }
) {
  const db = opts.tx ?? prisma;

  const original = await db.journalEntry.findUnique({
    where: { id },
    include: { lines: true, reversalFor: true },
  });
  if (!original) throw new Error("Journal entry not found.");
  if (original.status !== "POSTED") throw new Error("Only posted journal entries can be reversed.");
  if (original.reversalFor) throw new Error("This entry has already been reversed.");

  // The reversal entry's reversedById points back to the original
  const reversalLines: JournalLineInput[] = original.lines.map((l, idx) => ({
    debitAccountId:  l.creditPaise > 0 ? l.creditAccountId : null,
    creditAccountId: l.debitPaise  > 0 ? l.debitAccountId  : null,
    debitPaise:  l.creditPaise,
    creditPaise: l.debitPaise,
    description: `Reversal: ${l.description || ""}`,
    sortOrder: idx,
  }));

  const reversal = await createJournalEntry(
    {
      date: opts.date ?? new Date(),
      description: opts.description ?? `Reversal of ${original.number}`,
      reference: original.number,
      sourceType: "reversal",
      createdById: opts.createdById,
      lines: reversalLines,
      autoPost: true,
    },
    db as Prisma.TransactionClient
  );

  // Link the reversal to the original
  await db.journalEntry.update({
    where: { id: reversal.id },
    data: { reversedById: original.id },
  });

  return reversal;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export interface ListJournalParams {
  page?: number;
  q?: string;
  status?: JournalEntryStatus;
  startDate?: string;
  endDate?: string;
}

export async function listJournalEntries(params: ListJournalParams) {
  const page = Math.max(1, params.page ?? 1);
  const where: Prisma.JournalEntryWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.startDate || params.endDate
      ? {
          date: {
            ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
            ...(params.endDate   ? { lte: new Date(params.endDate + "T23:59:59") } : {}),
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { number: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
            { reference: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        lines: {
          include: {
            debitAccount:  { select: { code: true, name: true } },
            creditAccount: { select: { code: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.journalEntry.count({ where }),
  ]);

  const entriesWithTotals = entries.map((e) => {
    const totalDebit  = e.lines.reduce((s, l) => s + l.debitPaise, 0);
    const totalCredit = e.lines.reduce((s, l) => s + l.creditPaise, 0);
    return { ...e, totalDebit, totalCredit };
  });

  return { entries: entriesWithTotals, total, page, pageSize: PAGE_SIZE };
}

export async function getJournalEntryDetail(id: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          debitAccount:  { select: { id: true, code: true, name: true, type: true } },
          creditAccount: { select: { id: true, code: true, name: true, type: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      invoice:   { select: { id: true, number: true } },
      payment:   { select: { id: true, amountPaise: true, paymentDate: true } },
      expense:   { select: { id: true, number: true } },
      reversalFor: { select: { id: true, number: true } },
      reversedBy: { select: { id: true, number: true } },
    },
  });
  if (!entry) return null;

  const totalDebit  = entry.lines.reduce((s, l) => s + l.debitPaise, 0);
  const totalCredit = entry.lines.reduce((s, l) => s + l.creditPaise, 0);
  const isBalanced  = totalDebit === totalCredit && totalDebit > 0;

  return { ...entry, totalDebit, totalCredit, isBalanced };
}

// ---------------------------------------------------------------------------
// General Ledger
// ---------------------------------------------------------------------------

export interface LedgerLine {
  journalEntryId: string;
  journalNumber:  string;
  date:           Date;
  description:    string;
  sourceType:     string | null;
  sourceLink:     string | null; // e.g. "/invoices/xyz"
  debitPaise:     number;
  creditPaise:    number;
  runningBalance: number;
}

export async function getAccountLedger(
  accountId: string,
  opts?: { startDate?: string; endDate?: string; page?: number }
): Promise<{ lines: LedgerLine[]; openingBalance: number; closingBalance: number; total: number }> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");

  const dateFilter: Prisma.JournalEntryWhereInput["date"] = {
    ...(opts?.startDate ? { gte: new Date(opts.startDate) } : {}),
    ...(opts?.endDate   ? { lte: new Date(opts.endDate + "T23:59:59") } : {}),
  };

  // Fetch all debit lines for this account
  const debitLines = await prisma.journalEntryLine.findMany({
    where: {
      debitAccountId: accountId,
      journalEntry: { status: "POSTED", date: dateFilter },
    },
    include: {
      journalEntry: {
        select: {
          id: true, number: true, date: true, description: true, sourceType: true,
          invoiceId: true, paymentId: true, expenseId: true,
        },
      },
    },
    orderBy: [{ journalEntry: { date: "asc" } }, { journalEntry: { number: "asc" } }],
  });

  const creditLines = await prisma.journalEntryLine.findMany({
    where: {
      creditAccountId: accountId,
      journalEntry: { status: "POSTED", date: dateFilter },
    },
    include: {
      journalEntry: {
        select: {
          id: true, number: true, date: true, description: true, sourceType: true,
          invoiceId: true, paymentId: true, expenseId: true,
        },
      },
    },
    orderBy: [{ journalEntry: { date: "asc" } }, { journalEntry: { number: "asc" } }],
  });

  // Merge and sort by date + journal number
  type MergedLine = {
    journalEntry: { id: string; number: string; date: Date; description: string; sourceType: string | null; invoiceId: string | null; paymentId: string | null; expenseId: string | null };
    debitPaise: number;
    creditPaise: number;
  };

  const merged: MergedLine[] = [
    ...debitLines.map((l) => ({ journalEntry: l.journalEntry, debitPaise: l.debitPaise, creditPaise: 0 })),
    ...creditLines.map((l) => ({ journalEntry: l.journalEntry, debitPaise: 0, creditPaise: l.creditPaise })),
  ].sort((a, b) => {
    const dateDiff = a.journalEntry.date.getTime() - b.journalEntry.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.journalEntry.number.localeCompare(b.journalEntry.number);
  });

  const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";
  let runningBalance = account.openingBalancePaise;
  const lines: LedgerLine[] = merged.map((l) => {
    if (isDebitNormal) {
      runningBalance += l.debitPaise - l.creditPaise;
    } else {
      runningBalance += l.creditPaise - l.debitPaise;
    }

    const je = l.journalEntry;
    let sourceLink: string | null = null;
    if (je.sourceType === "invoice" && je.invoiceId) sourceLink = `/invoices/${je.invoiceId}`;
    else if (je.sourceType === "payment" && je.paymentId) sourceLink = `/payments/${je.paymentId}`;
    else if (je.sourceType === "expense" && je.expenseId) sourceLink = `/expenses/${je.expenseId}`;
    else if (je.sourceType === "manual") sourceLink = `/accounting/journal/${je.id}`;

    return {
      journalEntryId: je.id,
      journalNumber:  je.number,
      date:           je.date,
      description:    je.description,
      sourceType:     je.sourceType,
      sourceLink,
      debitPaise:     l.debitPaise,
      creditPaise:    l.creditPaise,
      runningBalance,
    };
  });

  const openingBalance = account.openingBalancePaise;
  const closingBalance = runningBalance;
  const total = merged.length;

  // Paginate
  const page = Math.max(1, opts?.page ?? 1);
  const pagedLines = lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { lines: pagedLines, openingBalance, closingBalance, total };
}
