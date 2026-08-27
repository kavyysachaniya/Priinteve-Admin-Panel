import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/services/invoices";
import { format, startOfDay, startOfMonth, startOfYear, subDays, eachDayOfInterval, eachMonthOfInterval, endOfYear } from "date-fns";

/** Returns total of all RECORDED expenses in integer paise. Excludes DRAFT & CANCELLED expenses. */
export async function getExpensesTotal(): Promise<number> {
  try {
    const result = await prisma.expense.aggregate({
      _sum: { totalAmountPaise: true },
      where: { status: "RECORDED" },
    });
    return result._sum.totalAmountPaise ?? 0;
  } catch (err) {
    console.error("Error in getExpensesTotal:", err);
    return 0;
  }
}

export function percentChange(current: number, previous: number): { pct: number | null; direction: "up" | "down" | "neutral" } {
  if (previous === 0) {
    if (current === 0) return { pct: 0, direction: "neutral" };
    return { pct: null, direction: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  return { pct, direction: pct > 0 ? "up" : pct < 0 ? "down" : "neutral" };
}

export async function getSummaryCards() {
  try {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subDays(monthStart, 1));
    const prevMonthEnd = monthStart;

    const [thisMonthPayments, lastMonthPayments, outstandingInvoices, totalExpenses, thisMonthExpenses, lastMonthExpenses] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amountPaise: true }, where: { paymentDate: { gte: monthStart } } }),
      prisma.payment.aggregate({
        _sum: { amountPaise: true },
        where: { paymentDate: { gte: prevMonthStart, lt: prevMonthEnd } },
      }),
      prisma.invoice.findMany({
        where: { status: { notIn: ["CANCELLED"] } },
        select: { totalPaise: true, amountPaidPaise: true },
      }),
      getExpensesTotal(),
      prisma.expense.aggregate({
        _sum: { totalAmountPaise: true },
        where: { status: "RECORDED", date: { gte: monthStart } },
      }),
      prisma.expense.aggregate({
        _sum: { totalAmountPaise: true },
        where: { status: "RECORDED", date: { gte: prevMonthStart, lt: prevMonthEnd } },
      }),
    ]);

    const revenue = thisMonthPayments._sum.amountPaise ?? 0;
    const lastRevenue = lastMonthPayments._sum.amountPaise ?? 0;
    const expenses = thisMonthExpenses._sum.totalAmountPaise ?? 0;
    const lastExpenses = lastMonthExpenses._sum.totalAmountPaise ?? 0;

    const outstanding = outstandingInvoices.reduce((sum, inv) => sum + (inv.totalPaise - inv.amountPaidPaise), 0);
    const netProfit = revenue - expenses;
    const lastNetProfit = lastRevenue - lastExpenses;

    return {
      revenuePaise: revenue,
      revenueChange: percentChange(revenue, lastRevenue),
      expensesPaise: totalExpenses,
      expensesChange: percentChange(expenses, lastExpenses),
      netProfitPaise: netProfit,
      netProfitChange: percentChange(netProfit, lastNetProfit),
      outstandingPaise: outstanding,
    };
  } catch (err) {
    console.error("Error in getSummaryCards:", err);
    return {
      revenuePaise: 0,
      revenueChange: { pct: 0, direction: "neutral" as const },
      expensesPaise: 0,
      expensesChange: { pct: 0, direction: "neutral" as const },
      netProfitPaise: 0,
      netProfitChange: { pct: 0, direction: "neutral" as const },
      outstandingPaise: 0,
    };
  }
}

export type RevenueRange = "7d" | "30d" | "month" | "year";

export async function getRevenueExpenseSeries(range: RevenueRange) {
  try {
    const now = new Date();
    let start: Date;
    let bucket: "day" | "month";

    switch (range) {
      case "7d":
        start = startOfDay(subDays(now, 6));
        bucket = "day";
        break;
      case "30d":
        start = startOfDay(subDays(now, 29));
        bucket = "day";
        break;
      case "month":
        start = startOfMonth(now);
        bucket = "day";
        break;
      case "year":
        start = startOfYear(now);
        bucket = "month";
        break;
    }

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: { paymentDate: { gte: start } },
        select: { paymentDate: true, amountPaise: true },
      }),
      prisma.expense.findMany({
        where: { status: "RECORDED", date: { gte: start } },
        select: { date: true, totalAmountPaise: true },
      }),
    ]);

    if (bucket === "day") {
      const days = eachDayOfInterval({ start, end: now });
      const revTotals = new Map(days.map((d) => [format(d, "yyyy-MM-dd"), 0]));
      const expTotals = new Map(days.map((d) => [format(d, "yyyy-MM-dd"), 0]));

      for (const p of payments) {
        const key = format(p.paymentDate, "yyyy-MM-dd");
        if (revTotals.has(key)) revTotals.set(key, (revTotals.get(key) ?? 0) + p.amountPaise);
      }
      for (const e of expenses) {
        const key = format(e.date, "yyyy-MM-dd");
        if (expTotals.has(key)) expTotals.set(key, (expTotals.get(key) ?? 0) + e.totalAmountPaise);
      }

      return days.map((d) => ({
        label: format(d, range === "7d" ? "EEE" : "d MMM"),
        revenuePaise: revTotals.get(format(d, "yyyy-MM-dd")) ?? 0,
        expensesPaise: expTotals.get(format(d, "yyyy-MM-dd")) ?? 0,
      }));
    }

    const months = eachMonthOfInterval({ start, end: endOfYear(now) <= now ? endOfYear(now) : now });
    const revTotals = new Map(months.map((m) => [format(m, "yyyy-MM"), 0]));
    const expTotals = new Map(months.map((m) => [format(m, "yyyy-MM"), 0]));

    for (const p of payments) {
      const key = format(p.paymentDate, "yyyy-MM");
      if (revTotals.has(key)) revTotals.set(key, (revTotals.get(key) ?? 0) + p.amountPaise);
    }
    for (const e of expenses) {
      const key = format(e.date, "yyyy-MM");
      if (expTotals.has(key)) expTotals.set(key, (expTotals.get(key) ?? 0) + e.totalAmountPaise);
    }

    return months.map((m) => ({
      label: format(m, "MMM"),
      revenuePaise: revTotals.get(format(m, "yyyy-MM")) ?? 0,
      expensesPaise: expTotals.get(format(m, "yyyy-MM")) ?? 0,
    }));
  } catch (err) {
    console.error("Error in getRevenueExpenseSeries:", err);
    return [];
  }
}

export async function getRecentActivity(limit = 8) {
  try {
    return await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  } catch (err) {
    console.error("Error in getRecentActivity:", err);
    return [];
  }
}

export interface AttentionItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function getNeedsAttention() {
  try {
    const [overdueRaw, pendingQuotations, recentInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: { in: ["SENT", "PARTIALLY_PAID"] } },
        include: { customer: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.quotation.findMany({
        where: { status: "SENT" },
        include: { customer: { select: { name: true } } },
        orderBy: { validUntil: "asc" },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: { status: { in: ["SENT", "PARTIALLY_PAID"] }, createdAt: { gte: subDays(new Date(), 7) } },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const overdueInvoices: AttentionItem[] = overdueRaw
      .filter((inv) => deriveInvoiceStatus(inv) === "OVERDUE")
      .slice(0, 5)
      .map((inv) => ({
        id: inv.id,
        title: `${inv.number} — ${inv.customer.name}`,
        subtitle: `Overdue since ${format(inv.dueDate, "d MMM yyyy")}`,
        href: `/invoices/${inv.id}`,
      }));

    const unpaidInvoices: AttentionItem[] = overdueRaw
      .filter((inv) => deriveInvoiceStatus(inv) !== "OVERDUE")
      .slice(0, 5)
      .map((inv) => ({
        id: inv.id,
        title: `${inv.number} — ${inv.customer.name}`,
        subtitle: `Due ${format(inv.dueDate, "d MMM yyyy")}`,
        href: `/invoices/${inv.id}`,
      }));

    return {
      overdueInvoices,
      pendingQuotations: pendingQuotations.map((q) => ({
        id: q.id,
        title: `${q.number} — ${q.customer.name}`,
        subtitle: `Valid until ${format(q.validUntil, "d MMM yyyy")}`,
        href: `/quotations/${q.id}`,
      })),
      unpaidInvoices,
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        title: `${inv.number} — ${inv.customer.name}`,
        subtitle: `Created ${format(inv.createdAt, "d MMM yyyy")}`,
        href: `/invoices/${inv.id}`,
      })),
    };
  } catch (err) {
    console.error("Error in getNeedsAttention:", err);
    return { overdueInvoices: [], pendingQuotations: [], unpaidInvoices: [], recentInvoices: [] };
  }
}

export async function getDashboardPhase2Data() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [todayTasks, pendingProductionCount, deliveriesTodayCount, recentExpenses] = await Promise.all([
      prisma.task.findMany({
        where: {
          dueDate: { gte: todayStart, lte: todayEnd },
          status: { not: "COMPLETED" },
        },
        include: { customer: { select: { name: true } } },
        take: 5,
      }),
      prisma.productionJob.count({
        where: { status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS", "QUALITY_CHECK"] } },
      }),
      prisma.delivery.count({
        where: {
          deliveryDate: { gte: todayStart, lte: todayEnd },
          status: { in: ["SCHEDULED", "OUT_FOR_DELIVERY"] },
        },
      }),
      prisma.expense.findMany({
        where: { status: "RECORDED" },
        orderBy: { date: "desc" },
        take: 5,
        include: { category: { select: { name: true } }, vendor: { select: { businessName: true } } },
      }),
    ]);

    return {
      todayTasks,
      pendingProductionCount,
      deliveriesTodayCount,
      recentExpenses,
    };
  } catch (err) {
    console.error("Error in getDashboardPhase2Data:", err);
    return { todayTasks: [], pendingProductionCount: 0, deliveriesTodayCount: 0, recentExpenses: [] };
  }
}

export interface RecentTransaction {
  id: string;
  date: Date;
  customer: string;
  type: "Quotation" | "Invoice" | "Payment" | "Order" | "Expense";
  reference: string;
  amountPaise: number;
  status: string;
  href: string;
}

export async function getRecentTransactions(limit = 8): Promise<RecentTransaction[]> {
  try {
    const [quotations, invoices, payments, expenses] = await Promise.all([
      prisma.quotation.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { customer: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { customer: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { customer: { select: { name: true } }, invoice: { select: { number: true } } },
      }),
      prisma.expense.findMany({
        where: { status: "RECORDED" },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { category: { select: { name: true } }, vendor: { select: { businessName: true } } },
      }),
    ]);

    const all: RecentTransaction[] = [
      ...quotations.map((q) => ({
        id: q.id,
        date: q.createdAt,
        customer: q.customer.name,
        type: "Quotation" as const,
        reference: q.number,
        amountPaise: q.totalPaise,
        status: q.status,
        href: `/quotations/${q.id}`,
      })),
      ...invoices.map((inv) => ({
        id: inv.id,
        date: inv.createdAt,
        customer: inv.customer.name,
        type: "Invoice" as const,
        reference: inv.number,
        amountPaise: inv.totalPaise,
        status: deriveInvoiceStatus(inv),
        href: `/invoices/${inv.id}`,
      })),
      ...payments.map((p) => ({
        id: p.id,
        date: p.createdAt,
        customer: p.customer.name,
        type: "Payment" as const,
        reference: p.invoice.number,
        amountPaise: p.amountPaise,
        status: "RECEIVED",
        href: `/invoices/${p.invoiceId}`,
      })),
      ...expenses.map((e) => ({
        id: e.id,
        date: e.date,
        customer: e.vendor ? e.vendor.businessName : e.category.name,
        type: "Expense" as const,
        reference: e.number,
        amountPaise: e.totalAmountPaise,
        status: e.status,
        href: `/expenses/${e.id}`,
      })),
    ];

    return all.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
  } catch (err) {
    console.error("Error in getRecentTransactions:", err);
    return [];
  }
}
