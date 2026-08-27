import { prisma } from "@/lib/prisma";
import { computeDocumentTotals, computeLineItem, rupeesToPaise, paiseToRupees } from "@/lib/money";
import { issueDocumentNumber } from "@/lib/services/numbering";
import { logActivity } from "@/lib/services/activity";
import { getCompanySettings } from "@/lib/services/settings";
import type { InvoiceFormValues } from "@/lib/validations/invoice";
import type { DocumentItemValues } from "@/lib/validations/document-item";
import type { Invoice, InvoiceStatus, Prisma } from "@prisma/client";

const PAGE_SIZE = 10;

/**
 * The persisted `status` only changes on explicit events (create, mark sent,
 * payment recorded, cancel). "Overdue" is derived at read time from the due
 * date instead of being written by a background job — there's no scheduler
 * in Phase 1, and deriving it keeps the displayed status always accurate.
 */
export function deriveInvoiceStatus(invoice: {
  status: InvoiceStatus;
  dueDate: Date;
  totalPaise: number;
  amountPaidPaise: number;
}): InvoiceStatus {
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED" || invoice.status === "PAID") {
    return invoice.status;
  }
  if (invoice.amountPaidPaise >= invoice.totalPaise) return "PAID";
  if (invoice.dueDate.getTime() < Date.now()) return "OVERDUE";
  if (invoice.amountPaidPaise > 0) return "PARTIALLY_PAID";
  return invoice.status;
}

export interface ListInvoicesParams {
  q?: string;
  status?: InvoiceStatus;
  page?: number;
}

export async function listInvoices(params: ListInvoicesParams) {
  const page = Math.max(1, params.page ?? 1);
  const where: Prisma.InvoiceWhereInput = {
    ...(params.q
      ? {
          OR: [
            { number: { contains: params.q } },
            { customer: { name: { contains: params.q } } },
          ],
        }
      : {}),
  };

  const [invoicesRaw, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.invoice.count({ where }),
  ]);

  let invoices = invoicesRaw.map((inv) => ({ ...inv, effectiveStatus: deriveInvoiceStatus(inv) }));

  if (params.status) {
    invoices = invoices.filter((inv) => inv.effectiveStatus === params.status);
  }

  const filteredTotal = params.status ? invoices.length : total;
  const paged = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { invoices: paged, total: filteredTotal, page, pageSize: PAGE_SIZE };
}

export async function getInvoiceDetail(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paymentDate: "desc" } },
      sourceQuotation: { select: { id: true, number: true } },
      activityLogs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) return null;
  return { ...invoice, effectiveStatus: deriveInvoiceStatus(invoice) };
}

function itemsToLineInputs(items: DocumentItemValues[]) {
  return items.map((item) => ({
    quantity: item.quantity,
    ratePaise: rupeesToPaise(item.rate),
    discountPercent: item.discountPercent,
    gstRate: item.gstRate,
  }));
}

function buildItemsCreate(items: DocumentItemValues[]) {
  return items.map((item, idx) => {
    const line = computeLineItem({
      quantity: item.quantity,
      ratePaise: rupeesToPaise(item.rate),
      discountPercent: item.discountPercent,
      gstRate: item.gstRate,
    });
    return {
      productId: item.productId || null,
      name: item.name,
      description: item.description || null,
      quantity: item.quantity,
      ratePaise: rupeesToPaise(item.rate),
      discountPercent: item.discountPercent,
      gstRate: item.gstRate,
      amountPaise: line.amountPaise,
      sortOrder: idx,
    };
  });
}

export async function createInvoice(data: InvoiceFormValues) {
  const totals = computeDocumentTotals(itemsToLineInputs(data.items), rupeesToPaise(data.shippingCharge));
  const settings = await getCompanySettings();

  return prisma.$transaction(async (tx) => {
    const number = await issueDocumentNumber(tx, "invoice");
    const invoice = await tx.invoice.create({
      data: {
        number,
        customerId: data.customerId,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        status: "DRAFT",
        notes: data.notes || null,
        terms: data.terms || settings.invoiceTerms,
        subtotalPaise: totals.subtotalPaise,
        discountPaise: totals.discountPaise,
        taxPaise: totals.taxPaise,
        shippingPaise: totals.shippingPaise,
        totalPaise: totals.totalPaise,
        amountPaidPaise: 0,
        items: { create: buildItemsCreate(data.items) },
      },
    });

    await logActivity(
      {
        type: "invoice.created",
        message: `Invoice ${invoice.number} created`,
        entityType: "invoice",
        entityId: invoice.id,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
      },
      tx
    );

    return invoice;
  });
}

function assertEditable(invoice: Invoice) {
  if (invoice.sourceQuotationId) {
    throw new Error("This invoice was generated from a quotation and can't be edited directly");
  }
  if (invoice.amountPaidPaise > 0) {
    throw new Error("Payments have been recorded against this invoice — it can no longer be edited");
  }
  if (invoice.status === "CANCELLED") {
    throw new Error("Cancelled invoices can't be edited");
  }
}

export async function updateInvoice(id: string, data: InvoiceFormValues) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new Error("Invoice not found");
  assertEditable(existing);

  const totals = computeDocumentTotals(itemsToLineInputs(data.items), rupeesToPaise(data.shippingCharge));

  return prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

    const invoice = await tx.invoice.update({
      where: { id },
      data: {
        customerId: data.customerId,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        notes: data.notes || null,
        terms: data.terms || null,
        subtotalPaise: totals.subtotalPaise,
        discountPaise: totals.discountPaise,
        taxPaise: totals.taxPaise,
        shippingPaise: totals.shippingPaise,
        totalPaise: totals.totalPaise,
        items: { create: buildItemsCreate(data.items) },
      },
    });

    await logActivity(
      {
        type: "invoice.updated",
        message: `Invoice ${invoice.number} updated`,
        entityType: "invoice",
        entityId: invoice.id,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
      },
      tx
    );

    return invoice;
  });
}

export async function markInvoiceSent(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "DRAFT") {
    throw new Error("Only draft invoices can be marked as sent");
  }
  const updated = await prisma.invoice.update({ where: { id }, data: { status: "SENT" } });
  await logActivity({
    type: "invoice.status_changed",
    message: `Invoice ${updated.number} marked as Sent`,
    entityType: "invoice",
    entityId: updated.id,
    customerId: updated.customerId,
    invoiceId: updated.id,
  });
  return updated;
}

export async function cancelInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.amountPaidPaise > 0) {
    throw new Error("Can't cancel an invoice that already has payments recorded against it");
  }
  if (invoice.status === "CANCELLED") {
    throw new Error("This invoice is already cancelled");
  }
  const updated = await prisma.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  await logActivity({
    type: "invoice.cancelled",
    message: `Invoice ${updated.number} cancelled`,
    entityType: "invoice",
    entityId: updated.id,
    customerId: updated.customerId,
    invoiceId: updated.id,
  });
  return updated;
}

export function invoiceToFormValues(
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>
): InvoiceFormValues {
  return {
    customerId: invoice.customerId,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
    shippingCharge: paiseToRupees(invoice.shippingPaise),
    items: invoice.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      description: item.description ?? "",
      quantity: item.quantity,
      rate: paiseToRupees(item.ratePaise),
      discountPercent: item.discountPercent,
      gstRate: item.gstRate,
    })),
  };
}
