/**
 * Chart of Accounts service — Phase 4
 *
 * All monetary balances are in paise (integer).
 * Account balances are computed from journal entry lines (not stored in the DB),
 * ensuring they always reflect the true ledger state.
 */

import { prisma } from "@/lib/prisma";
import type { AccountType, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Default Chart of Accounts for Priinteve
// ---------------------------------------------------------------------------

export const DEFAULT_CHART_OF_ACCOUNTS = [
  // ASSETS
  { code: "1010", name: "Cash in Hand",            type: "ASSET" as AccountType,     isSystem: true },
  { code: "1020", name: "Bank Account (HDFC)",      type: "ASSET" as AccountType,     isSystem: true },
  { code: "1030", name: "UPI Account",              type: "ASSET" as AccountType,     isSystem: false },
  { code: "1100", name: "Accounts Receivable",      type: "ASSET" as AccountType,     isSystem: true },
  { code: "1200", name: "Input GST Receivable",     type: "ASSET" as AccountType,     isSystem: true },
  { code: "1500", name: "Equipment & Assets",       type: "ASSET" as AccountType,     isSystem: false },
  // LIABILITIES
  { code: "2010", name: "Accounts Payable",         type: "LIABILITY" as AccountType, isSystem: true },
  { code: "2100", name: "Output GST Payable",       type: "LIABILITY" as AccountType, isSystem: true },
  { code: "2200", name: "IGST Payable",             type: "LIABILITY" as AccountType, isSystem: false },
  { code: "2300", name: "TDS Payable",              type: "LIABILITY" as AccountType, isSystem: false },
  { code: "2500", name: "Other Liabilities",        type: "LIABILITY" as AccountType, isSystem: false },
  // EQUITY
  { code: "3010", name: "Owner's Capital",          type: "EQUITY" as AccountType,    isSystem: true },
  { code: "3020", name: "Retained Earnings",        type: "EQUITY" as AccountType,    isSystem: true },
  { code: "3030", name: "Drawings",                 type: "EQUITY" as AccountType,    isSystem: false },
  // INCOME
  { code: "4010", name: "Printing Revenue",         type: "INCOME" as AccountType,    isSystem: false },
  { code: "4020", name: "Digital Card Revenue",     type: "INCOME" as AccountType,    isSystem: false },
  { code: "4030", name: "Digital Menu Revenue",     type: "INCOME" as AccountType,    isSystem: false },
  { code: "4040", name: "Design Revenue",           type: "INCOME" as AccountType,    isSystem: false },
  { code: "4050", name: "Website Revenue",          type: "INCOME" as AccountType,    isSystem: false },
  { code: "4900", name: "Other Service Revenue",    type: "INCOME" as AccountType,    isSystem: true },
  // EXPENSES
  { code: "5010", name: "Paper & Raw Materials",    type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5020", name: "Ink & Chemicals",          type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5030", name: "Packaging",                type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5040", name: "Equipment Maintenance",    type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5100", name: "Logistics & Courier",      type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5200", name: "Staff & Payroll",          type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5300", name: "Marketing & Advertising",  type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5400", name: "Software & Subscriptions", type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5410", name: "Hosting & Domain",         type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5500", name: "Office Expenses",          type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5600", name: "Utilities",                type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5700", name: "Travel & Transport",       type: "EXPENSE" as AccountType,   isSystem: false },
  { code: "5900", name: "Other Expenses",           type: "EXPENSE" as AccountType,   isSystem: true },
] as const;

// The system accounts always used by auto-accounting hooks
export const SYSTEM_ACCOUNT_CODES = {
  ACCOUNTS_RECEIVABLE: "1100",
  ACCOUNTS_PAYABLE:    "2010",
  OUTPUT_GST_PAYABLE:  "2100",
  INPUT_GST_RECEIVABLE:"1200",
  CASH:                "1010",
  BANK_HDFC:           "1020",
  SALES_REVENUE:       "4900",  // default; use category-specific if available
  OTHER_EXPENSES:      "5900",  // default expense account
} as const;

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

export async function seedChartOfAccounts() {
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name },
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        isSystem: acc.isSystem,
        isActive: true,
        openingBalancePaise: 0,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface AccountWithBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  openingBalancePaise: number;
  debitPaise: number;   // total debits from journal lines
  creditPaise: number;  // total credits from journal lines
  balancePaise: number; // opening + net movement (sign convention: debit-positive for assets/expenses)
}

export async function listAccounts(opts?: { type?: AccountType; activeOnly?: boolean }): Promise<AccountWithBalance[]> {
  const where: Prisma.AccountWhereInput = {
    ...(opts?.type ? { type: opts.type } : {}),
    ...(opts?.activeOnly ? { isActive: true } : {}),
  };

  const accounts = await prisma.account.findMany({
    where,
    orderBy: [{ code: "asc" }],
    include: {
      debitLines: {
        where: { journalEntry: { status: "POSTED" } },
        select: { debitPaise: true },
      },
      creditLines: {
        where: { journalEntry: { status: "POSTED" } },
        select: { creditPaise: true },
      },
    },
  });

  return accounts.map((acc) => {
    const debitPaise  = acc.debitLines.reduce((s, l) => s + l.debitPaise, 0);
    const creditPaise = acc.creditLines.reduce((s, l) => s + l.creditPaise, 0);

    // Normal balance convention:
    // ASSET, EXPENSE → debit-normal → balance = opening + debits - credits
    // LIABILITY, EQUITY, INCOME → credit-normal → balance = opening + credits - debits
    let balancePaise: number;
    if (acc.type === "ASSET" || acc.type === "EXPENSE") {
      balancePaise = acc.openingBalancePaise + debitPaise - creditPaise;
    } else {
      balancePaise = acc.openingBalancePaise + creditPaise - debitPaise;
    }

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      description: acc.description,
      isSystem: acc.isSystem,
      isActive: acc.isActive,
      openingBalancePaise: acc.openingBalancePaise,
      debitPaise,
      creditPaise,
      balancePaise,
    };
  });
}

export async function getAccountByCode(code: string) {
  return prisma.account.findUnique({ where: { code } });
}

export async function getAccountById(id: string) {
  return prisma.account.findUnique({ where: { id } });
}

export interface CashBankAccount {
  id: string;
  code: string;
  name: string;
  openingBalancePaise: number;
  totalInflowPaise: number;   // credits received (credit-side for liabilities, debit-side for assets)
  totalOutflowPaise: number;  // credits paid out
  currentBalancePaise: number;
}

export async function getCashBankAccounts(): Promise<CashBankAccount[]> {
  const accounts = await prisma.account.findMany({
    where: {
      type: "ASSET",
      code: { in: ["1010", "1020", "1030"] },
      isActive: true,
    },
    orderBy: { code: "asc" },
    include: {
      debitLines: {
        where: { journalEntry: { status: "POSTED" } },
        select: { debitPaise: true },
      },
      creditLines: {
        where: { journalEntry: { status: "POSTED" } },
        select: { creditPaise: true },
      },
    },
  });

  return accounts.map((acc) => {
    const totalInflowPaise  = acc.debitLines.reduce((s, l) => s + l.debitPaise, 0);
    const totalOutflowPaise = acc.creditLines.reduce((s, l) => s + l.creditPaise, 0);
    const currentBalancePaise = acc.openingBalancePaise + totalInflowPaise - totalOutflowPaise;

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      openingBalancePaise: acc.openingBalancePaise,
      totalInflowPaise,
      totalOutflowPaise,
      currentBalancePaise,
    };
  });
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  openingBalancePaise?: number;
}

export async function createAccount(data: CreateAccountInput) {
  return prisma.account.create({
    data: {
      code: data.code,
      name: data.name,
      type: data.type,
      description: data.description || null,
      openingBalancePaise: data.openingBalancePaise ?? 0,
      isSystem: false,
      isActive: true,
    },
  });
}

export interface UpdateAccountInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  openingBalancePaise?: number;
}

export async function updateAccount(id: string, data: UpdateAccountInput) {
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) throw new Error("Account not found");
  return prisma.account.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      isActive: data.isActive ?? existing.isActive,
      openingBalancePaise: data.openingBalancePaise ?? existing.openingBalancePaise,
    },
  });
}
