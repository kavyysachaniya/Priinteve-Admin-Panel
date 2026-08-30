/**
 * Financial Reports service — Phase 4
 *
 * All reports are derived from actual journal entries (POSTED status only).
 * Draft and Void journal entries are excluded from all financial reports.
 * This guarantees that reports match the underlying accounting data.
 */

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfYear, endOfYear, startOfMonth, endOfMonth,
         subMonths, startOfQuarter, endOfQuarter } from "date-fns";

// ---------------------------------------------------------------------------
// Date Ranges
// ---------------------------------------------------------------------------

export type DateRangePreset =
  | "today" | "this_week" | "this_month" | "last_month"
  | "this_quarter" | "this_year" | "custom";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function resolveDateRange(preset: DateRangePreset, custom?: { start?: string; end?: string }): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case "this_week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      return { startDate: startOfDay(d), endDate: endOfDay(now) };
    }
    case "this_month":
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    case "last_month": {
      const last = subMonths(now, 1);
      return { startDate: startOfMonth(last), endDate: endOfMonth(last) };
    }
    case "this_quarter":
      return { startDate: startOfQuarter(now), endDate: endOfQuarter(now) };
    case "this_year":
      return { startDate: startOfYear(now), endDate: endOfYear(now) };
    case "custom":
      return {
        startDate: custom?.start ? startOfDay(new Date(custom.start)) : startOfYear(now),
        endDate:   custom?.end   ? endOfDay(new Date(custom.end))     : endOfDay(now),
      };
    default:
      return { startDate: startOfYear(now), endDate: endOfDay(now) };
  }
}

// ---------------------------------------------------------------------------
// P&L (Profit & Loss)
// ---------------------------------------------------------------------------

export interface PLCategory {
  accountId:   string;
  accountCode: string;
  accountName: string;
  amountPaise: number;
}

export interface PLReport {
  startDate:          Date;
  endDate:            Date;
  incomeByAccount:    PLCategory[];
  expensesByAccount:  PLCategory[];
  totalIncomePaise:   number;
  totalExpensesPaise: number;
  netProfitPaise:     number;
}

export async function getProfitAndLoss(range: DateRange): Promise<PLReport> {
  // Income: credit-normal → credit lines minus debit lines for INCOME accounts
  const incomeAccounts = await prisma.account.findMany({
    where: { type: "INCOME", isActive: true },
    include: {
      creditLines: {
        where: { journalEntry: { status: "POSTED", date: { gte: range.startDate, lte: range.endDate } } },
        select: { creditPaise: true },
      },
      debitLines: {
        where: { journalEntry: { status: "POSTED", date: { gte: range.startDate, lte: range.endDate } } },
        select: { debitPaise: true },
      },
    },
    orderBy: { code: "asc" },
  });

  const incomeByAccount: PLCategory[] = incomeAccounts
    .map((acc) => ({
      accountId:   acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      amountPaise:
        acc.creditLines.reduce((s, l) => s + l.creditPaise, 0) -
        acc.debitLines.reduce((s, l) => s + l.debitPaise, 0),
    }))
    .filter((r) => r.amountPaise !== 0);

  // Expenses: debit-normal → debit lines minus credit lines for EXPENSE accounts
  const expenseAccounts = await prisma.account.findMany({
    where: { type: "EXPENSE", isActive: true },
    include: {
      debitLines: {
        where: { journalEntry: { status: "POSTED", date: { gte: range.startDate, lte: range.endDate } } },
        select: { debitPaise: true },
      },
      creditLines: {
        where: { journalEntry: { status: "POSTED", date: { gte: range.startDate, lte: range.endDate } } },
        select: { creditPaise: true },
      },
    },
    orderBy: { code: "asc" },
  });

  const expensesByAccount: PLCategory[] = expenseAccounts
    .map((acc) => ({
      accountId:   acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      amountPaise:
        acc.debitLines.reduce((s, l) => s + l.debitPaise, 0) -
        acc.creditLines.reduce((s, l) => s + l.creditPaise, 0),
    }))
    .filter((r) => r.amountPaise !== 0);

  const totalIncomePaise   = incomeByAccount.reduce((s, r) => s + r.amountPaise, 0);
  const totalExpensesPaise = expensesByAccount.reduce((s, r) => s + r.amountPaise, 0);

  return {
    startDate: range.startDate,
    endDate:   range.endDate,
    incomeByAccount,
    expensesByAccount,
    totalIncomePaise,
    totalExpensesPaise,
    netProfitPaise: totalIncomePaise - totalExpensesPaise,
  };
}

// ---------------------------------------------------------------------------
// Balance Sheet
// ---------------------------------------------------------------------------

export interface BSSection {
  accountId:   string;
  accountCode: string;
  accountName: string;
  balancePaise: number;
}

export interface BalanceSheetReport {
  asOf:              Date;
  assets:            BSSection[];
  liabilities:       BSSection[];
  equity:            BSSection[];
  totalAssets:       number;
  totalLiabilities:  number;
  totalEquity:       number;
  isBalanced:        boolean;
  imbalancePaise:    number;
  retainedEarnings:  number; // cumulative net profit injected into equity
}

export async function getBalanceSheet(asOf: Date): Promise<BalanceSheetReport> {
  const dateFilter = { lte: asOf };

  const accounts = await prisma.account.findMany({
    where: { isActive: true, type: { in: ["ASSET", "LIABILITY", "EQUITY"] } },
    include: {
      debitLines: {
        where: { journalEntry: { status: "POSTED", date: dateFilter } },
        select: { debitPaise: true },
      },
      creditLines: {
        where: { journalEntry: { status: "POSTED", date: dateFilter } },
        select: { creditPaise: true },
      },
    },
    orderBy: { code: "asc" },
  });

  const mapSection = (type: "ASSET" | "LIABILITY" | "EQUITY"): BSSection[] =>
    accounts
      .filter((a) => a.type === type)
      .map((a) => {
        const debits  = a.debitLines.reduce((s, l) => s + l.debitPaise, 0);
        const credits = a.creditLines.reduce((s, l) => s + l.creditPaise, 0);
        let balance: number;
        if (type === "ASSET") {
          balance = a.openingBalancePaise + debits - credits;
        } else {
          balance = a.openingBalancePaise + credits - debits;
        }
        return { accountId: a.id, accountCode: a.code, accountName: a.name, balancePaise: balance };
      });

  const assets      = mapSection("ASSET");
  const liabilities = mapSection("LIABILITY");
  const equity      = mapSection("EQUITY");

  // Compute cumulative net profit (all time up to asOf) as retained earnings
  const plAllTime = await getProfitAndLoss({ startDate: new Date("2020-01-01"), endDate: asOf });
  const retainedEarnings = plAllTime.netProfitPaise;

  const totalAssets      = assets.reduce((s, r) => s + r.balancePaise, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.balancePaise, 0);
  const totalEquity      = equity.reduce((s, r) => s + r.balancePaise, 0) + retainedEarnings;
  const imbalancePaise   = totalAssets - (totalLiabilities + totalEquity);
  const isBalanced       = Math.abs(imbalancePaise) <= 1; // 1 paise tolerance for rounding

  return {
    asOf,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    isBalanced,
    imbalancePaise,
    retainedEarnings,
  };
}

// ---------------------------------------------------------------------------
// Cash Flow
// ---------------------------------------------------------------------------

export interface CashFlowReport {
  startDate:             Date;
  endDate:               Date;
  openingCashPaise:      number;
  operatingInflowPaise:  number;
  operatingOutflowPaise: number;
  netOperatingPaise:     number;
  closingCashPaise:      number;
  // Detailed
  inflows:  { description: string; amountPaise: number; date: Date }[];
  outflows: { description: string; amountPaise: number; date: Date }[];
}

export async function getCashFlow(range: DateRange): Promise<CashFlowReport> {
  // Cash/Bank asset account codes
  const cashAccounts = await prisma.account.findMany({
    where: { type: "ASSET", code: { in: ["1010", "1020", "1030"] } },
    select: { id: true, code: true, name: true, openingBalancePaise: true },
  });
  const cashAccountIds = cashAccounts.map((a) => a.id);
  const totalOpeningCash = cashAccounts.reduce((s, a) => s + a.openingBalancePaise, 0);

  // Inflows: debits to cash/bank accounts (money coming in)
  const inflowLines = await prisma.journalEntryLine.findMany({
    where: {
      debitAccountId: { in: cashAccountIds },
      journalEntry: {
        status: "POSTED",
        date: { gte: range.startDate, lte: range.endDate },
      },
    },
    include: {
      journalEntry: {
        select: { date: true, description: true, reference: true },
      },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  // Outflows: credits to cash/bank accounts (money going out)
  const outflowLines = await prisma.journalEntryLine.findMany({
    where: {
      creditAccountId: { in: cashAccountIds },
      journalEntry: {
        status: "POSTED",
        date: { gte: range.startDate, lte: range.endDate },
      },
    },
    include: {
      journalEntry: {
        select: { date: true, description: true, reference: true },
      },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  // Calculate pre-period cash balance
  const prePeriodDebit = await prisma.journalEntryLine.aggregate({
    where: { debitAccountId: { in: cashAccountIds }, journalEntry: { status: "POSTED", date: { lt: range.startDate } } },
    _sum: { debitPaise: true },
  });
  const prePeriodCredit = await prisma.journalEntryLine.aggregate({
    where: { creditAccountId: { in: cashAccountIds }, journalEntry: { status: "POSTED", date: { lt: range.startDate } } },
    _sum: { creditPaise: true },
  });
  const openingCashPaise = totalOpeningCash +
    (prePeriodDebit._sum.debitPaise ?? 0) - (prePeriodCredit._sum.creditPaise ?? 0);

  const inflows  = inflowLines.map((l) => ({
    description: `${l.journalEntry.description}${l.journalEntry.reference ? ` (${l.journalEntry.reference})` : ""}`,
    amountPaise: l.debitPaise,
    date:        l.journalEntry.date,
  }));
  const outflows = outflowLines.map((l) => ({
    description: `${l.journalEntry.description}${l.journalEntry.reference ? ` (${l.journalEntry.reference})` : ""}`,
    amountPaise: l.creditPaise,
    date:        l.journalEntry.date,
  }));

  const operatingInflowPaise  = inflows.reduce((s, r) => s + r.amountPaise, 0);
  const operatingOutflowPaise = outflows.reduce((s, r) => s + r.amountPaise, 0);
  const netOperatingPaise     = operatingInflowPaise - operatingOutflowPaise;
  const closingCashPaise      = openingCashPaise + netOperatingPaise;

  return {
    startDate: range.startDate,
    endDate:   range.endDate,
    openingCashPaise,
    operatingInflowPaise,
    operatingOutflowPaise,
    netOperatingPaise,
    closingCashPaise,
    inflows,
    outflows,
  };
}

// ---------------------------------------------------------------------------
// GST / Tax Summary
// ---------------------------------------------------------------------------

export interface GSTEntry {
  date:        Date;
  reference:   string | null;
  description: string;
  gstPaise:    number;
  journalEntryId: string;
  sourceType:  string | null;
}

export interface GSTReport {
  startDate:            Date;
  endDate:              Date;
  outputGstPaise:       number;
  inputGstPaise:        number;
  netGstPayablePaise:   number; // positive = payable, negative = refund due
  outputEntries:        GSTEntry[];
  inputEntries:         GSTEntry[];
}

export async function getGSTReport(range: DateRange): Promise<GSTReport> {
  const [outputGstAccount, inputGstAccount] = await Promise.all([
    prisma.account.findUnique({ where: { code: "2100" } }),
    prisma.account.findUnique({ where: { code: "1200" } }),
  ]);

  const outputEntries: GSTEntry[] = [];
  const inputEntries:  GSTEntry[] = [];

  const [outputLines, inputLines] = await Promise.all([
    outputGstAccount
      ? prisma.journalEntryLine.findMany({
          where: {
            creditAccountId: outputGstAccount.id,
            journalEntry: { status: "POSTED", date: { gte: range.startDate, lte: range.endDate } },
          },
          include: {
            journalEntry: { select: { id: true, date: true, description: true, reference: true, sourceType: true } },
          },
          orderBy: { journalEntry: { date: "asc" } },
        })
      : Promise.resolve([]),
    inputGstAccount
      ? prisma.journalEntryLine.findMany({
          where: {
            debitAccountId: inputGstAccount.id,
            journalEntry: { status: "POSTED", date: { gte: range.startDate, lte: range.endDate } },
          },
          include: {
            journalEntry: { select: { id: true, date: true, description: true, reference: true, sourceType: true } },
          },
          orderBy: { journalEntry: { date: "asc" } },
        })
      : Promise.resolve([]),
  ]);

  for (const l of outputLines) {
    outputEntries.push({
      date:           l.journalEntry.date,
      reference:      l.journalEntry.reference,
      description:    l.journalEntry.description,
      gstPaise:       l.creditPaise,
      journalEntryId: l.journalEntry.id,
      sourceType:     l.journalEntry.sourceType,
    });
  }

  for (const l of inputLines) {
    inputEntries.push({
      date:           l.journalEntry.date,
      reference:      l.journalEntry.reference,
      description:    l.journalEntry.description,
      gstPaise:       l.debitPaise,
      journalEntryId: l.journalEntry.id,
      sourceType:     l.journalEntry.sourceType,
    });
  }

  const outputGstPaise     = outputEntries.reduce((s, r) => s + r.gstPaise, 0);
  const inputGstPaise      = inputEntries.reduce((s, r) => s + r.gstPaise, 0);
  const netGstPayablePaise = outputGstPaise - inputGstPaise;

  return { startDate: range.startDate, endDate: range.endDate, outputGstPaise, inputGstPaise, netGstPayablePaise, outputEntries, inputEntries };
}

// ---------------------------------------------------------------------------
// Receivables Aging
// ---------------------------------------------------------------------------

export interface ReceivablesCustomer {
  customerId:     string;
  customerName:   string;
  totalPaise:     number;
  paidPaise:      number;
  outstandingPaise: number;
  overdueCount:   number;
  items: {
    invoiceId:   string;
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate:     Date;
    totalPaise:  number;
    paidPaise:   number;
    outstandingPaise: number;
    daysOverdue: number;
    status:      string;
  }[];
}

export async function getReceivables(): Promise<ReceivablesCustomer[]> {
  const invoices = await prisma.invoice.findMany({
    where: { status: { notIn: ["CANCELLED", "DRAFT"] } },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: [{ customerId: "asc" }, { dueDate: "asc" }],
  });

  const now = new Date();
  const customerMap = new Map<string, ReceivablesCustomer>();

  for (const inv of invoices) {
    const outstanding = inv.totalPaise - inv.amountPaidPaise;
    if (outstanding <= 0 && inv.status === "PAID") continue; // fully paid

    const daysOverdue = inv.dueDate < now ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000) : 0;

    const item = {
      invoiceId:       inv.id,
      invoiceNumber:   inv.number,
      invoiceDate:     inv.invoiceDate,
      dueDate:         inv.dueDate,
      totalPaise:      inv.totalPaise,
      paidPaise:       inv.amountPaidPaise,
      outstandingPaise: outstanding,
      daysOverdue,
      status:          outstanding <= 0 ? "PAID" : daysOverdue > 0 ? "OVERDUE" : "CURRENT",
    };

    const existing = customerMap.get(inv.customerId);
    if (existing) {
      existing.totalPaise       += inv.totalPaise;
      existing.paidPaise        += inv.amountPaidPaise;
      existing.outstandingPaise += outstanding;
      if (daysOverdue > 0) existing.overdueCount++;
      existing.items.push(item);
    } else {
      customerMap.set(inv.customerId, {
        customerId:       inv.customerId,
        customerName:     inv.customer.name,
        totalPaise:       inv.totalPaise,
        paidPaise:        inv.amountPaidPaise,
        outstandingPaise: outstanding,
        overdueCount:     daysOverdue > 0 ? 1 : 0,
        items:            [item],
      });
    }
  }

  return Array.from(customerMap.values()).sort((a, b) => b.outstandingPaise - a.outstandingPaise);
}

// ---------------------------------------------------------------------------
// Payables (Vendor)
// ---------------------------------------------------------------------------

export interface PayablesVendor {
  vendorId:         string;
  vendorName:       string;
  totalPaise:       number;
  outstandingPaise: number;
  items: {
    expenseId:    string;
    expenseNumber: string;
    date:          Date;
    description:   string;
    totalPaise:    number;
    outstandingPaise: number;
    status:        string;
  }[];
}

export async function getPayables(): Promise<PayablesVendor[]> {
  // Payables = expenses with vendors that are recorded (not cancelled)
  const expenses = await prisma.expense.findMany({
    where: {
      vendorId: { not: null },
      status:   "RECORDED",
    },
    include: { vendor: { select: { id: true, businessName: true } } },
    orderBy: [{ vendorId: "asc" }, { date: "asc" }],
  });

  const vendorMap = new Map<string, PayablesVendor>();
  for (const exp of expenses) {
    if (!exp.vendor) continue;
    const item = {
      expenseId:        exp.id,
      expenseNumber:    exp.number,
      date:             exp.date,
      description:      exp.description,
      totalPaise:       exp.totalAmountPaise,
      outstandingPaise: exp.totalAmountPaise, // all expenses are considered payable until explicitly cleared
      status:           "DUE",
    };

    const existing = vendorMap.get(exp.vendor.id);
    if (existing) {
      existing.totalPaise       += exp.totalAmountPaise;
      existing.outstandingPaise += exp.totalAmountPaise;
      existing.items.push(item);
    } else {
      vendorMap.set(exp.vendor.id, {
        vendorId:         exp.vendor.id,
        vendorName:       exp.vendor.businessName,
        totalPaise:       exp.totalAmountPaise,
        outstandingPaise: exp.totalAmountPaise,
        items:            [item],
      });
    }
  }

  return Array.from(vendorMap.values()).sort((a, b) => b.outstandingPaise - a.outstandingPaise);
}
