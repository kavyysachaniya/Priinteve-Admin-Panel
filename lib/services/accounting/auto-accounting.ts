/**
 * Auto-Accounting Engine — Phase 4
 *
 * Generates balanced journal entries automatically from business events:
 *   - Invoice sent/created → AR debit, Revenue + GST credit
 *   - Customer payment → Cash/Bank debit, AR credit
 *   - Expense recorded → Expense + Input GST debit, Cash/Bank/AP credit
 *   - Cancellations → reversal journal entries
 *
 * These functions are called INSIDE the business service transactions
 * (invoices.ts, payments.ts, expenses.ts) so everything stays atomic.
 */

import { prisma } from "@/lib/prisma";
import { getAccountByCode, SYSTEM_ACCOUNT_CODES } from "./accounts";
import type { Invoice, Payment, Expense, Prisma } from "@prisma/client";
import { createJournalEntry } from "./journal";

// ---------------------------------------------------------------------------
// Helper — resolve an account by code, throw if not found
// ---------------------------------------------------------------------------

async function requireAccount(code: string, db: Prisma.TransactionClient) {
  const acc = await db.account.findUnique({ where: { code } });
  if (!acc) {
    throw new Error(
      `Accounting setup error: Required account with code "${code}" not found. ` +
      `Run the Chart of Accounts seed to initialise system accounts.`
    );
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Map product category → revenue account code
// ---------------------------------------------------------------------------

const REVENUE_ACCOUNT_CODES: Record<string, string> = {
  "4010": "Printing",
  "4020": "Digital Card",
  "4030": "Digital Menu",
  "4040": "Design",
  "4050": "Website",
};

// We default to 4900 (Other Service Revenue) unless the product category maps to something specific.
async function getRevenueAccountId(db: Prisma.TransactionClient): Promise<string> {
  const acc = await db.account.findUnique({ where: { code: SYSTEM_ACCOUNT_CODES.SALES_REVENUE } });
  return acc?.id ?? (await requireAccount(SYSTEM_ACCOUNT_CODES.SALES_REVENUE, db)).id;
}

// Map expense category name → expense account code
const EXPENSE_CATEGORY_MAP: Record<string, string> = {
  "Paper & Raw Materials": "5010",
  "Ink & Chemicals":       "5020",
  "Packaging":             "5030",
  "Equipment Maintenance": "5040",
  "Logistics & Transport": "5100",
  "Staff & Payroll":       "5200",
  "Marketing & Advertising":"5300",
  "Marketing & Office":    "5300",
  "Software & Tools":      "5400",
  "Software & Subscriptions":"5400",
  "Hosting & Domain":      "5410",
  "Office Expenses":       "5500",
  "Utilities & Rent":      "5600",
  "Travel & Transport":    "5700",
};

async function getExpenseAccountId(categoryName: string, db: Prisma.TransactionClient): Promise<string> {
  const code = EXPENSE_CATEGORY_MAP[categoryName] ?? SYSTEM_ACCOUNT_CODES.OTHER_EXPENSES;
  const acc = await db.account.findFirst({ where: { code } });
  if (acc) return acc.id;
  const fallback = await db.account.findUnique({ where: { code: SYSTEM_ACCOUNT_CODES.OTHER_EXPENSES } });
  if (!fallback) throw new Error("Expense account not configured. Please seed the Chart of Accounts.");
  return fallback.id;
}

// Determine which bank/cash account to use based on payment method + optional accountId
async function resolveCashBankAccountId(
  method: string,
  paymentAccountId: string | null | undefined,
  db: Prisma.TransactionClient
): Promise<string> {
  // If a specific account was chosen, use it
  if (paymentAccountId) {
    const acc = await db.account.findUnique({ where: { id: paymentAccountId } });
    if (acc) return acc.id;
  }

  // Fallback based on payment method
  let code: string = SYSTEM_ACCOUNT_CODES.CASH; // default: Cash in Hand
  if (method === "BANK_TRANSFER" || method === "CARD") {
    code = SYSTEM_ACCOUNT_CODES.BANK_HDFC;
  } else if (method === "UPI") {
    const upi = await db.account.findUnique({ where: { code: "1030" } });
    if (upi) return upi.id;
    code = SYSTEM_ACCOUNT_CODES.BANK_HDFC; // UPI usually settles to bank
  }

  const acc = await db.account.findUnique({ where: { code } });
  if (!acc) throw new Error(`Cash/Bank account (${code}) not configured. Please seed the Chart of Accounts.`);
  return acc.id;
}

// ---------------------------------------------------------------------------
// 1. INVOICE: Debit AR, Credit Revenue + Output GST
// ---------------------------------------------------------------------------

export async function postInvoiceJournal(
  invoice: Pick<Invoice, "id" | "number" | "invoiceDate" | "subtotalPaise" | "taxPaise" | "shippingPaise" | "totalPaise">,
  createdById: string | undefined,
  db: Prisma.TransactionClient
) {
  // Skip if accounting isn't set up (non-fatal)
  const arAccount = await db.account.findUnique({
    where: { code: SYSTEM_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE },
  });
  if (!arAccount) return; // graceful: accounting not yet seeded

  const revenueAccountId  = await getRevenueAccountId(db);
  const gstAccountId      = invoice.taxPaise > 0
    ? (await db.account.findUnique({ where: { code: SYSTEM_ACCOUNT_CODES.OUTPUT_GST_PAYABLE } }))?.id
    : undefined;

  const lines = [];

  // Debit: Accounts Receivable for the full invoice amount
  lines.push({
    debitAccountId:  arAccount.id,
    creditAccountId: null,
    debitPaise:      invoice.totalPaise,
    creditPaise:     0,
    description:     `AR - Invoice ${invoice.number}`,
    sortOrder:       0,
  });

  // Credit: Revenue (subtotal + shipping, before tax)
  const revenueAmount = invoice.subtotalPaise + invoice.shippingPaise;
  lines.push({
    debitAccountId:  null,
    creditAccountId: revenueAccountId,
    debitPaise:      0,
    creditPaise:     revenueAmount,
    description:     `Revenue - Invoice ${invoice.number}`,
    sortOrder:       1,
  });

  // Credit: Output GST if applicable
  if (invoice.taxPaise > 0 && gstAccountId) {
    lines.push({
      debitAccountId:  null,
      creditAccountId: gstAccountId,
      debitPaise:      0,
      creditPaise:     invoice.taxPaise,
      description:     `Output GST - Invoice ${invoice.number}`,
      sortOrder:       2,
    });
  }

  await createJournalEntry(
    {
      date:        invoice.invoiceDate,
      description: `Invoice ${invoice.number} issued`,
      reference:   invoice.number,
      sourceType:  "invoice",
      invoiceId:   invoice.id,
      createdById,
      lines,
      autoPost:    true,
    },
    db
  );
}

// ---------------------------------------------------------------------------
// 2. PAYMENT: Debit Cash/Bank, Credit AR
// ---------------------------------------------------------------------------

export async function postPaymentJournal(
  payment: Pick<Payment, "id" | "amountPaise" | "paymentDate" | "method" | "paymentAccountId">,
  invoiceNumber: string,
  createdById: string | undefined,
  db: Prisma.TransactionClient
) {
  const arAccount = await db.account.findUnique({
    where: { code: SYSTEM_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE },
  });
  if (!arAccount) return;

  const cashBankId = await resolveCashBankAccountId(payment.method, payment.paymentAccountId, db);

  await createJournalEntry(
    {
      date:        payment.paymentDate,
      description: `Payment received - ${invoiceNumber}`,
      reference:   invoiceNumber,
      sourceType:  "payment",
      paymentId:   payment.id,
      createdById,
      lines: [
        {
          debitAccountId:  cashBankId,
          creditAccountId: null,
          debitPaise:      payment.amountPaise,
          creditPaise:     0,
          description:     `Cash/Bank - Payment for ${invoiceNumber}`,
          sortOrder:       0,
        },
        {
          debitAccountId:  null,
          creditAccountId: arAccount.id,
          debitPaise:      0,
          creditPaise:     payment.amountPaise,
          description:     `AR - Payment for ${invoiceNumber}`,
          sortOrder:       1,
        },
      ],
      autoPost: true,
    },
    db
  );
}

// ---------------------------------------------------------------------------
// 3. EXPENSE: Debit Expense + Input GST, Credit Cash/Bank
// ---------------------------------------------------------------------------

export async function postExpenseJournal(
  expense: Pick<Expense, "id" | "number" | "date" | "baseAmountPaise" | "gstAmountPaise" | "totalAmountPaise" | "paymentMethod" | "paymentAccountId">,
  categoryName: string,
  createdById: string | undefined,
  db: Prisma.TransactionClient
) {
  const expAccountId = await db.account.findFirst({
    where: { code: SYSTEM_ACCOUNT_CODES.OTHER_EXPENSES },
  });
  if (!expAccountId) return; // accounting not yet seeded

  const expenseAccountId  = await getExpenseAccountId(categoryName, db);
  const cashBankId        = await resolveCashBankAccountId(expense.paymentMethod, expense.paymentAccountId, db);
  const inputGstAccount   = expense.gstAmountPaise > 0
    ? await db.account.findUnique({ where: { code: SYSTEM_ACCOUNT_CODES.INPUT_GST_RECEIVABLE } })
    : null;

  const lines = [];

  // Debit: Expense account (base amount)
  lines.push({
    debitAccountId:  expenseAccountId,
    creditAccountId: null,
    debitPaise:      expense.baseAmountPaise,
    creditPaise:     0,
    description:     `Expense - ${expense.number}`,
    sortOrder:       0,
  });

  // Debit: Input GST (if applicable)
  if (expense.gstAmountPaise > 0 && inputGstAccount) {
    lines.push({
      debitAccountId:  inputGstAccount.id,
      creditAccountId: null,
      debitPaise:      expense.gstAmountPaise,
      creditPaise:     0,
      description:     `Input GST - ${expense.number}`,
      sortOrder:       1,
    });
  }

  // Credit: Cash/Bank (total amount)
  lines.push({
    debitAccountId:  null,
    creditAccountId: cashBankId,
    debitPaise:      0,
    creditPaise:     expense.totalAmountPaise,
    description:     `Payment - ${expense.number}`,
    sortOrder:       2,
  });

  await createJournalEntry(
    {
      date:        expense.date,
      description: `Expense ${expense.number} recorded`,
      reference:   expense.number,
      sourceType:  "expense",
      expenseId:   expense.id,
      createdById,
      lines,
      autoPost:    true,
    },
    db
  );
}

// ---------------------------------------------------------------------------
// 4. Reversal wrappers (called when Invoice is cancelled / Payment deleted)
// ---------------------------------------------------------------------------

export async function reverseInvoiceJournal(
  invoiceId: string,
  reason: string,
  createdById: string | undefined,
  db: Prisma.TransactionClient
) {
  const { reverseJournalEntry } = await import("./journal");
  const existing = await db.journalEntry.findFirst({
    where: { invoiceId, sourceType: "invoice", status: "POSTED" },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return; // no journal to reverse
  await reverseJournalEntry(existing.id, { date: new Date(), description: reason, createdById, tx: db });
}

export async function reversePaymentJournal(
  paymentId: string,
  reason: string,
  createdById: string | undefined,
  db: Prisma.TransactionClient
) {
  const { reverseJournalEntry } = await import("./journal");
  const existing = await db.journalEntry.findFirst({
    where: { paymentId, sourceType: "payment", status: "POSTED" },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return;
  await reverseJournalEntry(existing.id, { date: new Date(), description: reason, createdById, tx: db });
}

export async function reverseExpenseJournal(
  expenseId: string,
  reason: string,
  createdById: string | undefined,
  db: Prisma.TransactionClient
) {
  const { reverseJournalEntry } = await import("./journal");
  const existing = await db.journalEntry.findFirst({
    where: { expenseId, sourceType: "expense", status: "POSTED" },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return;
  await reverseJournalEntry(existing.id, { date: new Date(), description: reason, createdById, tx: db });
}
