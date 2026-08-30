/**
 * Customer & Vendor Statements — Phase 4
 *
 * Statement shows chronological list of invoices/payments for customers
 * and expenses for vendors with a running balance.
 */

import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/services/invoices";

// ---------------------------------------------------------------------------
// Customer Statement
// ---------------------------------------------------------------------------

export interface StatementLine {
  date:         Date;
  reference:    string;
  description:  string;
  debitPaise:   number;   // Invoice → debit (amount owed)
  creditPaise:  number;   // Payment → credit (amount paid)
  balance:      number;   // running balance
  type:         "invoice" | "payment";
  sourceId:     string;
}

export interface CustomerStatement {
  customerId:   string;
  customerName: string;
  startDate:    Date | null;
  endDate:      Date | null;
  lines:        StatementLine[];
  openingBalance: number;
  closingBalance: number;
}

export async function getCustomerStatement(
  customerId: string,
  opts?: { startDate?: string; endDate?: string }
): Promise<CustomerStatement | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true },
  });
  if (!customer) return null;

  const startDate = opts?.startDate ? new Date(opts.startDate) : undefined;
  const endDate   = opts?.endDate   ? new Date(opts.endDate + "T23:59:59") : undefined;

  // Get all invoices and payments, then sort by date
  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        customerId,
        status: { not: "CANCELLED" },
        ...(startDate || endDate
          ? { invoiceDate: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : {}),
      },
      orderBy: { invoiceDate: "asc" },
      select: {
        id: true, number: true, invoiceDate: true, dueDate: true,
        totalPaise: true, amountPaidPaise: true, status: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        customerId,
        ...(startDate || endDate
          ? { paymentDate: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : {}),
      },
      orderBy: { paymentDate: "asc" },
      include: { invoice: { select: { number: true } } },
    }),
  ]);

  // Merge and sort chronologically
  type Event = { date: Date; type: "invoice" | "payment"; data: typeof invoices[0] | typeof payments[0] };
  const events: Event[] = [
    ...invoices.map((inv) => ({ date: inv.invoiceDate, type: "invoice" as const, data: inv })),
    ...payments.map((pay) => ({ date: pay.paymentDate, type: "payment" as const, data: pay })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;
  const lines: StatementLine[] = events.map((event) => {
    if (event.type === "invoice") {
      const inv = event.data as typeof invoices[0];
      runningBalance += inv.totalPaise;
      return {
        date:        inv.invoiceDate,
        reference:   inv.number,
        description: `Invoice ${inv.number}`,
        debitPaise:  inv.totalPaise,
        creditPaise: 0,
        balance:     runningBalance,
        type:        "invoice" as const,
        sourceId:    inv.id,
      };
    } else {
      const pay = event.data as typeof payments[0];
      runningBalance -= pay.amountPaise;
      return {
        date:        pay.paymentDate,
        reference:   pay.referenceNumber || pay.invoice?.number || "",
        description: `Payment${pay.invoice?.number ? ` against ${pay.invoice.number}` : ""}`,
        debitPaise:  0,
        creditPaise: pay.amountPaise,
        balance:     runningBalance,
        type:        "payment" as const,
        sourceId:    pay.id,
      };
    }
  });

  return {
    customerId:     customer.id,
    customerName:   customer.name,
    startDate:      startDate ?? null,
    endDate:        endDate   ?? null,
    lines,
    openingBalance: 0,
    closingBalance: runningBalance,
  };
}

// ---------------------------------------------------------------------------
// Vendor Statement
// ---------------------------------------------------------------------------

export interface VendorStatement {
  vendorId:       string;
  vendorName:     string;
  startDate:      Date | null;
  endDate:        Date | null;
  lines:          StatementLine[];
  openingBalance: number;
  closingBalance: number;
}

export async function getVendorStatement(
  vendorId: string,
  opts?: { startDate?: string; endDate?: string }
): Promise<VendorStatement | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, businessName: true },
  });
  if (!vendor) return null;

  const startDate = opts?.startDate ? new Date(opts.startDate) : undefined;
  const endDate   = opts?.endDate   ? new Date(opts.endDate + "T23:59:59") : undefined;

  const expenses = await prisma.expense.findMany({
    where: {
      vendorId,
      status: { not: "CANCELLED" },
      ...(startDate || endDate
        ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
        : {}),
    },
    orderBy: { date: "asc" },
  });

  let runningBalance = 0;
  const lines: StatementLine[] = expenses.map((exp) => {
    runningBalance += exp.totalAmountPaise;
    return {
      date:        exp.date,
      reference:   exp.number,
      description: exp.description,
      debitPaise:  exp.totalAmountPaise,
      creditPaise: 0,
      balance:     runningBalance,
      type:        "invoice" as const, // expenses are "bills" here
      sourceId:    exp.id,
    };
  });

  return {
    vendorId:       vendor.id,
    vendorName:     vendor.businessName,
    startDate:      startDate ?? null,
    endDate:        endDate   ?? null,
    lines,
    openingBalance: 0,
    closingBalance: runningBalance,
  };
}
