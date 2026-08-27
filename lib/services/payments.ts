import { prisma } from "@/lib/prisma";
import { rupeesToPaise } from "@/lib/money";
import { logActivity } from "@/lib/services/activity";
import type { PaymentFormValues } from "@/lib/validations/payment";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 10;

export interface ListPaymentsParams {
  q?: string;
  page?: number;
}

export async function listPayments(params: ListPaymentsParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where: Prisma.PaymentWhereInput = params.q
      ? {
          OR: [
            { referenceNumber: { contains: params.q } },
            { customer: { name: { contains: params.q } } },
            { invoice: { number: { contains: params.q } } },
          ],
        }
      : {};

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          customer: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listPayments:", err);
    return { payments: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

/** Invoices with an outstanding balance, for the Record Payment picker. */
export async function listPayableInvoices() {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: { notIn: ["CANCELLED"] } },
      orderBy: { invoiceDate: "desc" },
      select: {
        id: true,
        number: true,
        customerId: true,
        totalPaise: true,
        amountPaidPaise: true,
        dueDate: true,
      },
    });
    return invoices
      .map((inv) => ({ ...inv, outstandingPaise: inv.totalPaise - inv.amountPaidPaise }))
      .filter((inv) => inv.outstandingPaise > 0);
  } catch (err) {
    console.error("Error in listPayableInvoices:", err);
    return [];
  }
}

export async function createPayment(data: PaymentFormValues) {
  const amountPaise = rupeesToPaise(data.amount);

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.customerId !== data.customerId) throw new Error("Selected invoice doesn't belong to this customer");
    if (invoice.status === "CANCELLED") throw new Error("Can't record a payment against a cancelled invoice");

    const outstandingPaise = invoice.totalPaise - invoice.amountPaidPaise;
    if (amountPaise > outstandingPaise) {
      throw new Error(
        `Payment amount can't exceed the outstanding balance of ${(outstandingPaise / 100).toFixed(2)}`
      );
    }

    const payment = await tx.payment.create({
      data: {
        customerId: data.customerId,
        invoiceId: data.invoiceId,
        paymentDate: new Date(data.paymentDate),
        amountPaise,
        method: data.method,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
      },
    });

    const newAmountPaid = invoice.amountPaidPaise + amountPaise;
    const newStatus = newAmountPaid >= invoice.totalPaise ? "PAID" : "PARTIALLY_PAID";

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaidPaise: newAmountPaid, status: newStatus },
    });

    await logActivity(
      {
        type: "payment.recorded",
        message: `Payment of ${(amountPaise / 100).toFixed(2)} received for invoice ${invoice.number}`,
        entityType: "payment",
        entityId: payment.id,
        customerId: payment.customerId,
        invoiceId: invoice.id,
        paymentId: payment.id,
      },
      tx
    );

    if (newStatus === "PAID") {
      await logActivity(
        {
          type: "invoice.status_changed",
          message: `Invoice ${updatedInvoice.number} is now fully paid`,
          entityType: "invoice",
          entityId: updatedInvoice.id,
          customerId: updatedInvoice.customerId,
          invoiceId: updatedInvoice.id,
        },
        tx
      );
    }

    return payment;
  });
}

export async function getPaymentDetail(id: string) {
  return prisma.payment.findUnique({
    where: { id },
    include: { customer: true, invoice: true },
  });
}

export async function deletePayment(id: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id }, include: { invoice: true } });
    if (!payment) throw new Error("Payment not found");

    const newAmountPaid = Math.max(0, payment.invoice.amountPaidPaise - payment.amountPaise);
    const newStatus =
      newAmountPaid >= payment.invoice.totalPaise ? "PAID" : newAmountPaid > 0 ? "PARTIALLY_PAID" : "SENT";

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { amountPaidPaise: newAmountPaid, status: newStatus },
    });

    await tx.activityLog.updateMany({ where: { paymentId: id }, data: { paymentId: null } });
    await tx.payment.delete({ where: { id } });

    await logActivity(
      {
        type: "payment.deleted",
        message: `Payment of ${(payment.amountPaise / 100).toFixed(2)} removed from invoice ${payment.invoice.number}`,
        entityType: "invoice",
        entityId: payment.invoiceId,
        customerId: payment.customerId,
        invoiceId: payment.invoiceId,
      },
      tx
    );
  });
}
