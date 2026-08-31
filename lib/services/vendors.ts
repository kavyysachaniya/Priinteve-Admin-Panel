import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import type { VendorFormValues } from "@/lib/validations/vendor";
import type { Prisma, Vendor, VendorStatus } from "@prisma/client";

const PAGE_SIZE = 15;

export interface ListVendorsParams {
  q?: string;
  status?: VendorStatus;
  page?: number;
}

export type VendorListItem = Prisma.VendorGetPayload<{
  include: {
    expenses: {
      select: { totalAmountPaise: true; status: true };
    };
  };
}> & {
  totalExpensesPaise: number;
  transactionCount: number;
};

export async function listVendors(params: ListVendorsParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where: Prisma.VendorWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { businessName: { contains: params.q } },
              { contactPerson: { contains: params.q } },
              { phone: { contains: params.q } },
              { email: { contains: params.q } },
              { gstin: { contains: params.q } },
            ],
          }
        : {}),
    };

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        orderBy: { businessName: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          expenses: {
            select: { totalAmountPaise: true, status: true },
          },
        },
      }),
      prisma.vendor.count({ where }),
    ]);

    const vendorsWithTotals: VendorListItem[] = vendors.map((v) => {
      const recordedExpenses = v.expenses.filter((e) => e.status === "RECORDED");
      const totalExpensesPaise = recordedExpenses.reduce((sum, e) => sum + e.totalAmountPaise, 0);
      return {
        ...v,
        totalExpensesPaise,
        transactionCount: recordedExpenses.length,
      };
    });

    return { vendors: vendorsWithTotals, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listVendors:", err);
    return { vendors: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function listAllActiveVendors() {
  try {
    return await prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true, phone: true, email: true, gstin: true },
    });
  } catch (err) {
    console.error("Error in listAllActiveVendors:", err);
    return [];
  }
}

export async function getVendorDetail(id: string) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        expenses: {
          orderBy: { date: "desc" },
          include: { category: { select: { id: true, name: true } } },
        },
      },
    });
    if (!vendor) return null;

    const activityLogs = await prisma.activityLog.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const recordedExpenses = vendor.expenses.filter((e) => e.status === "RECORDED");
    const totalExpensesPaise = recordedExpenses.reduce((sum, e) => sum + e.totalAmountPaise, 0);

    return {
      ...vendor,
      totalExpensesPaise,
      transactionCount: recordedExpenses.length,
      latestExpense: vendor.expenses[0] ?? null,
      activityLogs,
    };
  } catch (err) {
    console.error("Error in getVendorDetail:", err);
    return null;
  }
}

export type VendorDetail = NonNullable<Awaited<ReturnType<typeof getVendorDetail>>>;

export function vendorToFormValues(vendor: Vendor): VendorFormValues {
  return {
    businessName: vendor.businessName,
    contactPerson: vendor.contactPerson ?? "",
    phone: vendor.phone,
    email: vendor.email ?? "",
    gstin: vendor.gstin ?? "",
    address: vendor.address ?? "",
    city: vendor.city ?? "",
    state: vendor.state ?? "",
    pincode: vendor.pincode ?? "",
    status: vendor.status,
    notes: vendor.notes ?? "",
  };
}

export async function createVendor(data: VendorFormValues) {
  const vendor = await prisma.vendor.create({
    data: {
      businessName: data.businessName,
      contactPerson: data.contactPerson || null,
      phone: data.phone,
      email: data.email || null,
      gstin: data.gstin ? data.gstin.toUpperCase() : null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      status: data.status,
      notes: data.notes || null,
    },
  });

  await logActivity({
    type: "vendor.created",
    message: `Vendor profile created: "${vendor.businessName}"`,
    entityType: "vendor",
    entityId: vendor.id,
    vendorId: vendor.id,
  });

  return vendor;
}

export async function updateVendor(id: string, data: VendorFormValues) {
  const vendor = await prisma.vendor.update({
    where: { id },
    data: {
      businessName: data.businessName,
      contactPerson: data.contactPerson || null,
      phone: data.phone,
      email: data.email || null,
      gstin: data.gstin ? data.gstin.toUpperCase() : null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      status: data.status,
      notes: data.notes || null,
    },
  });

  await logActivity({
    type: "vendor.updated",
    message: `Vendor details updated: "${vendor.businessName}"`,
    entityType: "vendor",
    entityId: vendor.id,
    vendorId: vendor.id,
  });

  return vendor;
}

export async function deleteVendor(id: string) {
  return prisma.vendor.delete({ where: { id } });
}
