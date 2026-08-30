/**
 * Accounting Periods service — Phase 4
 */
import { prisma } from "@/lib/prisma";

export async function listAccountingPeriods() {
  return prisma.accountingPeriod.findMany({ orderBy: { startDate: "desc" } });
}

export async function getOpenPeriods() {
  return prisma.accountingPeriod.findMany({
    where: { status: "OPEN" },
    orderBy: { startDate: "desc" },
  });
}

export async function createAccountingPeriod(data: { name: string; startDate: string; endDate: string }) {
  return prisma.accountingPeriod.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate + "T23:59:59"),
      status: "OPEN",
    },
  });
}

export async function togglePeriodStatus(id: string) {
  const period = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!period) throw new Error("Period not found");
  return prisma.accountingPeriod.update({
    where: { id },
    data: { status: period.status === "OPEN" ? "CLOSED" : "OPEN" },
  });
}

/**
 * Check if a given date falls within an open accounting period.
 * Returns true if at least one open period covers the date, or if
 * no periods exist at all (permissive when periods haven't been set up).
 */
export async function isDateInOpenPeriod(date: Date): Promise<boolean> {
  const totalPeriods = await prisma.accountingPeriod.count();
  if (totalPeriods === 0) return true; // no periods configured — allow all

  const period = await prisma.accountingPeriod.findFirst({
    where: {
      status: "OPEN",
      startDate: { lte: date },
      endDate:   { gte: date },
    },
  });
  return !!period;
}
