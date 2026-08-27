import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import type { CustomerFormValues } from "@/lib/validations/customer";
import type { Prisma, CustomerStatus } from "@prisma/client";

const PAGE_SIZE = 10;

export interface ListCustomersParams {
  q?: string;
  status?: CustomerStatus;
  page?: number;
}

export async function listCustomers(params: ListCustomersParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where: Prisma.CustomerWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q } },
              { phone: { contains: params.q } },
              { email: { contains: params.q } },
              { gstin: { contains: params.q } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          invoices: { select: { totalPaise: true, amountPaidPaise: true, status: true, createdAt: true } },
          payments: { select: { paymentDate: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const rows = customers.map((c) => {
      const totalBusiness = c.invoices
        .filter((i) => i.status !== "CANCELLED")
        .reduce((sum, i) => sum + i.totalPaise, 0);
      const outstanding = c.invoices
        .filter((i) => i.status !== "CANCELLED")
        .reduce((sum, i) => sum + (i.totalPaise - i.amountPaidPaise), 0);
      const dates = [
        ...c.invoices.map((i) => i.createdAt),
        ...c.payments.map((p) => p.paymentDate),
      ];
      const lastTransactionAt = dates.length
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : null;
      return {
        ...c,
        totalBusinessPaise: totalBusiness,
        outstandingPaise: outstanding,
        lastTransactionAt,
      };
    });

    return { customers: rows, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listCustomers:", err);
    return { customers: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function listAllActiveCustomers() {
  try {
    return await prisma.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, email: true, type: true, gstin: true },
    });
  } catch (err) {
    console.error("Error in listAllActiveCustomers:", err);
    return [];
  }
}

export async function getCustomerById(id: string) {
  try {
    return await prisma.customer.findUnique({ where: { id } });
  } catch (err) {
    console.error("Error in getCustomerById:", err);
    return null;
  }
}

export async function getCustomerWithFinancials(id: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: { orderBy: { createdAt: "desc" } },
        quotations: { orderBy: { createdAt: "desc" } },
        payments: { orderBy: { paymentDate: "desc" }, include: { invoice: { select: { number: true } } } },
        orders: { orderBy: { createdAt: "desc" } },
        tasks: { orderBy: { createdAt: "desc" } },
        notesList: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!customer) return null;

    const activeInvoices = customer.invoices.filter((i) => i.status !== "CANCELLED");
    const totalBusinessPaise = activeInvoices.reduce((sum, i) => sum + i.totalPaise, 0);
    const totalPaidPaise = activeInvoices.reduce((sum, i) => sum + i.amountPaidPaise, 0);
    const outstandingPaise = totalBusinessPaise - totalPaidPaise;

    const activity = await prisma.activityLog.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return {
      customer,
      financials: {
        totalBusinessPaise,
        totalPaidPaise,
        outstandingPaise,
        quotationsCount: customer.quotations.length,
        invoicesCount: customer.invoices.length,
        ordersCount: customer.orders.length,
      },
      activity,
    };
  } catch (err) {
    console.error("Error in getCustomerWithFinancials:", err);
    return null;
  }
}

function toDbFields(data: CustomerFormValues) {
  return {
    type: data.type,
    name: data.name,
    contactPerson: data.contactPerson || null,
    phone: data.phone,
    whatsapp: data.whatsapp || null,
    email: data.email || null,
    gstin: data.gstin || null,
    pan: data.pan || null,
    billingAddress: data.billingAddress || null,
    shippingAddress: data.shippingAddress || null,
    city: data.city || null,
    state: data.state || null,
    pincode: data.pincode || null,
    notes: data.notes || null,
    tags: data.tags || null,
    status: data.status,
  };
}

export async function createCustomer(data: CustomerFormValues) {
  const customer = await prisma.customer.create({ data: toDbFields(data) });
  await logActivity({
    type: "customer.created",
    message: `New customer added: ${customer.name}`,
    entityType: "customer",
    entityId: customer.id,
    customerId: customer.id,
  });
  return customer;
}

export async function updateCustomer(id: string, data: CustomerFormValues) {
  const customer = await prisma.customer.update({ where: { id }, data: toDbFields(data) });
  await logActivity({
    type: "customer.updated",
    message: `Customer updated: ${customer.name}`,
    entityType: "customer",
    entityId: customer.id,
    customerId: customer.id,
  });
  return customer;
}

export async function canDeleteCustomer(id: string) {
  try {
    const [quotations, invoices, payments] = await Promise.all([
      prisma.quotation.count({ where: { customerId: id } }),
      prisma.invoice.count({ where: { customerId: id } }),
      prisma.payment.count({ where: { customerId: id } }),
    ]);
    return quotations === 0 && invoices === 0 && payments === 0;
  } catch (err) {
    console.error("Error in canDeleteCustomer:", err);
    return false;
  }
}

export async function deleteCustomer(id: string) {
  const allowed = await canDeleteCustomer(id);
  if (!allowed) {
    throw new Error(
      "This customer has quotations, invoices, or payments on record. Mark them Inactive instead of deleting."
    );
  }
  await prisma.customer.delete({ where: { id } });
}
