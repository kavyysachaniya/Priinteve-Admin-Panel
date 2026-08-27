import { prisma } from "@/lib/prisma";
import { computeDocumentTotals, computeLineItem, rupeesToPaise, paiseToRupees } from "@/lib/money";
import { issueDocumentNumber } from "@/lib/services/numbering";
import { logActivity } from "@/lib/services/activity";
import { getCompanySettings } from "@/lib/services/settings";
import type { QuotationFormValues } from "@/lib/validations/quotation";
import type { DocumentItemValues } from "@/lib/validations/document-item";
import type { Prisma, QuotationStatus } from "@prisma/client";

const PAGE_SIZE = 10;

export interface ListQuotationsParams {
  q?: string;
  status?: QuotationStatus;
  page?: number;
}

export async function listQuotations(params: ListQuotationsParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where: Prisma.QuotationWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { number: { contains: params.q } },
              { customer: { name: { contains: params.q } } },
            ],
          }
        : {}),
    };

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { customer: { select: { id: true, name: true } } },
      }),
      prisma.quotation.count({ where }),
    ]);

    return { quotations, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listQuotations:", err);
    return { quotations: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function getQuotationDetail(id: string) {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: "asc" } },
        convertedInvoice: { select: { id: true, number: true, status: true } },
        activityLogs: { orderBy: { createdAt: "desc" } },
      },
    });
    return quotation;
  } catch (err) {
    console.error("Error in getQuotationDetail:", err);
    return null;
  }
}

function itemsToLineInputs(items: DocumentItemValues[]) {
  return items.map((item) => ({
    quantity: item.quantity,
    ratePaise: rupeesToPaise(item.rate),
    discountPercent: item.discountPercent,
    gstRate: item.gstRate,
  }));
}

const STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: ["REJECTED"],
  REJECTED: [],
  EXPIRED: [],
  CONVERTED: [],
};

export async function createQuotation(data: QuotationFormValues) {
  const totals = computeDocumentTotals(itemsToLineInputs(data.items), rupeesToPaise(data.shippingCharge));

  return prisma.$transaction(async (tx) => {
    const number = await issueDocumentNumber(tx, "quotation");
    const quotation = await tx.quotation.create({
      data: {
        number,
        customerId: data.customerId,
        issueDate: new Date(data.issueDate),
        validUntil: new Date(data.validUntil),
        status: "DRAFT",
        notes: data.notes || null,
        terms: data.terms || null,
        subtotalPaise: totals.subtotalPaise,
        discountPaise: totals.discountPaise,
        taxPaise: totals.taxPaise,
        shippingPaise: totals.shippingPaise,
        totalPaise: totals.totalPaise,
        items: {
          create: data.items.map((item, idx) => {
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
          }),
        },
      },
    });

    await logActivity(
      {
        type: "quotation.created",
        message: `Quotation ${quotation.number} created`,
        entityType: "quotation",
        entityId: quotation.id,
        customerId: quotation.customerId,
        quotationId: quotation.id,
      },
      tx
    );

    return quotation;
  });
}

export async function updateQuotation(id: string, data: QuotationFormValues) {
  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) throw new Error("Quotation not found");
  if (existing.status === "CONVERTED") {
    throw new Error("This quotation has already been converted to an invoice and can't be edited");
  }

  const totals = computeDocumentTotals(itemsToLineInputs(data.items), rupeesToPaise(data.shippingCharge));

  return prisma.$transaction(async (tx) => {
    await tx.quotationItem.deleteMany({ where: { quotationId: id } });

    const quotation = await tx.quotation.update({
      where: { id },
      data: {
        customerId: data.customerId,
        issueDate: new Date(data.issueDate),
        validUntil: new Date(data.validUntil),
        notes: data.notes || null,
        terms: data.terms || null,
        subtotalPaise: totals.subtotalPaise,
        discountPaise: totals.discountPaise,
        taxPaise: totals.taxPaise,
        shippingPaise: totals.shippingPaise,
        totalPaise: totals.totalPaise,
        items: {
          create: data.items.map((item, idx) => {
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
          }),
        },
      },
    });

    await logActivity(
      {
        type: "quotation.updated",
        message: `Quotation ${quotation.number} updated`,
        entityType: "quotation",
        entityId: quotation.id,
        customerId: quotation.customerId,
        quotationId: quotation.id,
      },
      tx
    );

    return quotation;
  });
}

export async function changeQuotationStatus(id: string, next: QuotationStatus) {
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) throw new Error("Quotation not found");

  const allowed = STATUS_TRANSITIONS[quotation.status];
  if (!allowed.includes(next)) {
    throw new Error(`Can't move a ${quotation.status.toLowerCase()} quotation to ${next.toLowerCase()}`);
  }

  const updated = await prisma.quotation.update({ where: { id }, data: { status: next } });
  await logActivity({
    type: "quotation.status_changed",
    message: `Quotation ${updated.number} marked as ${next.charAt(0) + next.slice(1).toLowerCase()}`,
    entityType: "quotation",
    entityId: updated.id,
    customerId: updated.customerId,
    quotationId: updated.id,
  });
  return updated;
}

export async function convertQuotationToInvoice(id: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, convertedInvoice: true },
  });
  if (!quotation) throw new Error("Quotation not found");
  if (quotation.status !== "ACCEPTED") {
    throw new Error("Only accepted quotations can be converted to an invoice");
  }
  if (quotation.convertedInvoice) {
    throw new Error("This quotation has already been converted to an invoice");
  }

  const settings = await getCompanySettings();
  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + settings.defaultDueDays);

  return prisma.$transaction(async (tx) => {
    const number = await issueDocumentNumber(tx, "invoice");
    const invoice = await tx.invoice.create({
      data: {
        number,
        customerId: quotation.customerId,
        invoiceDate,
        dueDate,
        status: "DRAFT",
        notes: quotation.notes,
        terms: settings.invoiceTerms,
        subtotalPaise: quotation.subtotalPaise,
        discountPaise: quotation.discountPaise,
        taxPaise: quotation.taxPaise,
        shippingPaise: quotation.shippingPaise,
        totalPaise: quotation.totalPaise,
        amountPaidPaise: 0,
        sourceQuotationId: quotation.id,
        items: {
          create: quotation.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            ratePaise: item.ratePaise,
            discountPercent: item.discountPercent,
            gstRate: item.gstRate,
            amountPaise: item.amountPaise,
            sortOrder: item.sortOrder,
          })),
        },
      },
    });

    await tx.quotation.update({ where: { id: quotation.id }, data: { status: "CONVERTED" } });

    await logActivity(
      {
        type: "quotation.converted",
        message: `Quotation ${quotation.number} converted to invoice ${invoice.number}`,
        entityType: "quotation",
        entityId: quotation.id,
        customerId: quotation.customerId,
        quotationId: quotation.id,
      },
      tx
    );
    await logActivity(
      {
        type: "invoice.created",
        message: `Invoice ${invoice.number} created from quotation ${quotation.number}`,
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

export async function duplicateQuotation(id: string) {
  const source = await prisma.quotation.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!source) throw new Error("Quotation not found");

  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 15);

  return prisma.$transaction(async (tx) => {
    const number = await issueDocumentNumber(tx, "quotation");
    const quotation = await tx.quotation.create({
      data: {
        number,
        customerId: source.customerId,
        issueDate: today,
        validUntil,
        status: "DRAFT",
        notes: source.notes,
        terms: source.terms,
        subtotalPaise: source.subtotalPaise,
        discountPaise: source.discountPaise,
        taxPaise: source.taxPaise,
        shippingPaise: source.shippingPaise,
        totalPaise: source.totalPaise,
        items: {
          create: source.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            ratePaise: item.ratePaise,
            discountPercent: item.discountPercent,
            gstRate: item.gstRate,
            amountPaise: item.amountPaise,
            sortOrder: item.sortOrder,
          })),
        },
      },
    });

    await logActivity(
      {
        type: "quotation.created",
        message: `Quotation ${quotation.number} created as a duplicate of ${source.number}`,
        entityType: "quotation",
        entityId: quotation.id,
        customerId: quotation.customerId,
        quotationId: quotation.id,
      },
      tx
    );

    return quotation;
  });
}

export async function deleteQuotation(id: string) {
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) throw new Error("Quotation not found");
  if (quotation.status !== "DRAFT") {
    throw new Error("Only draft quotations can be deleted. Cancel or reject it instead.");
  }
  await prisma.quotation.delete({ where: { id } });
}

export function quotationToFormValues(
  quotation: NonNullable<Awaited<ReturnType<typeof getQuotationDetail>>>
): QuotationFormValues {
  return {
    customerId: quotation.customerId,
    issueDate: quotation.issueDate.toISOString().slice(0, 10),
    validUntil: quotation.validUntil.toISOString().slice(0, 10),
    notes: quotation.notes ?? "",
    terms: quotation.terms ?? "",
    shippingCharge: paiseToRupees(quotation.shippingPaise),
    items: quotation.items.map((item) => ({
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
