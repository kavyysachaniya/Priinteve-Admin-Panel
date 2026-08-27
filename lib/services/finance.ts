import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/services/invoices";
import { getExpensesTotal } from "@/lib/services/dashboard";
import { format, startOfYear, eachMonthOfInterval } from "date-fns";

export async function getFinanceOverview() {
  const [payments, invoices, expensesTotal, expensesByCategory] = await Promise.all([
    prisma.payment.findMany({ select: { amountPaise: true } }),
    prisma.invoice.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true, status: true, dueDate: true, totalPaise: true, amountPaidPaise: true },
    }),
    getExpensesTotal(),
    getExpenseBreakdownByCategory(),
  ]);

  const revenuePaise = payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const receivablesPaise = invoices.reduce((sum, inv) => sum + (inv.totalPaise - inv.amountPaidPaise), 0);

  const summary = { PAID: 0, PARTIALLY_PAID: 0, SENT: 0, OVERDUE: 0, DRAFT: 0 } as Record<string, number>;
  for (const inv of invoices) {
    const effective = deriveInvoiceStatus(inv);
    summary[effective] = (summary[effective] ?? 0) + 1;
  }

  return {
    revenuePaise,
    expensesPaise: expensesTotal,
    netProfitPaise: revenuePaise - expensesTotal,
    receivablesPaise,
    expensesByCategory,
    invoiceSummary: {
      paid: summary.PAID ?? 0,
      partiallyPaid: summary.PARTIALLY_PAID ?? 0,
      unpaid: summary.SENT ?? 0,
      overdue: summary.OVERDUE ?? 0,
      draft: summary.DRAFT ?? 0,
    },
  };
}

export interface ExpenseCategoryBreakdown {
  id: string;
  name: string;
  totalPaise: number;
}

export async function getExpenseBreakdownByCategory(): Promise<ExpenseCategoryBreakdown[]> {
  const expenses = await prisma.expense.findMany({
    where: { status: "RECORDED" },
    include: { category: { select: { id: true, name: true } } },
  });

  const categoryMap = new Map<string, { name: string; totalPaise: number }>();
  for (const e of expenses) {
    const current = categoryMap.get(e.categoryId) ?? { name: e.category.name, totalPaise: 0 };
    current.totalPaise += e.totalAmountPaise;
    categoryMap.set(e.categoryId, current);
  }

  return Array.from(categoryMap.entries())
    .map(([id, val]) => ({ id, name: val.name, totalPaise: val.totalPaise }))
    .sort((a, b) => b.totalPaise - a.totalPaise);
}

export interface FinancialActivityItem {
  id: string;
  date: Date;
  type: "inflow" | "outflow";
  title: string;
  categoryOrCustomer: string;
  amountPaise: number;
  href: string;
}

export async function getRecentFinancialActivity(limit = 10): Promise<FinancialActivityItem[]> {
  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { paymentDate: "desc" },
      take: limit,
      include: { customer: { select: { name: true } }, invoice: { select: { number: true } } },
    }),
    prisma.expense.findMany({
      where: { status: "RECORDED" },
      orderBy: { date: "desc" },
      take: limit,
      include: { category: { select: { name: true } }, vendor: { select: { businessName: true } } },
    }),
  ]);

  const all: FinancialActivityItem[] = [
    ...payments.map((p) => ({
      id: `pay-${p.id}`,
      date: p.paymentDate,
      type: "inflow" as const,
      title: `Payment Received (${p.invoice.number})`,
      categoryOrCustomer: p.customer.name,
      amountPaise: p.amountPaise,
      href: `/invoices/${p.invoiceId}`,
    })),
    ...expenses.map((e) => ({
      id: `exp-${e.id}`,
      date: e.date,
      type: "outflow" as const,
      title: e.description,
      categoryOrCustomer: e.vendor ? e.vendor.businessName : e.category.name,
      amountPaise: e.totalAmountPaise,
      href: `/expenses/${e.id}`,
    })),
  ];

  return all.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}

export async function getMonthlyRevenueThisYear() {
  const now = new Date();
  const start = startOfYear(now);
  const months = eachMonthOfInterval({ start, end: now });

  const payments = await prisma.payment.findMany({
    where: { paymentDate: { gte: start } },
    select: { paymentDate: true, amountPaise: true },
  });

  const totals = new Map(months.map((m) => [format(m, "yyyy-MM"), 0]));
  for (const p of payments) {
    const key = format(p.paymentDate, "yyyy-MM");
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + p.amountPaise);
  }

  return months.map((m) => ({ label: format(m, "MMM"), revenuePaise: totals.get(format(m, "yyyy-MM")) ?? 0 }));
}

export interface TopCustomer {
  id: string;
  name: string;
  totalBusinessPaise: number;
  invoiceCount: number;
}

export async function getTopCustomers(limit = 5): Promise<TopCustomer[]> {
  const customers = await prisma.customer.findMany({
    include: { invoices: { where: { status: { not: "CANCELLED" } }, select: { totalPaise: true } } },
  });

  return customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      totalBusinessPaise: c.invoices.reduce((sum, inv) => sum + inv.totalPaise, 0),
      invoiceCount: c.invoices.length,
    }))
    .filter((c) => c.totalBusinessPaise > 0)
    .sort((a, b) => b.totalBusinessPaise - a.totalBusinessPaise)
    .slice(0, limit);
}
