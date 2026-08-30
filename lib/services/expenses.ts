import { prisma } from "@/lib/prisma";
import { generateExpenseNumber } from "@/lib/services/numbering";
import { logActivity } from "@/lib/services/activity";
import { postExpenseJournal, reverseExpenseJournal } from "@/lib/services/accounting/auto-accounting";
import type { ExpenseFormValues } from "@/lib/validations/expense";
import type { Prisma, ExpenseStatus } from "@prisma/client";

const PAGE_SIZE = 15;

export interface ListExpensesParams {
  q?: string;
  status?: ExpenseStatus;
  categoryId?: string;
  vendorId?: string;
  page?: number;
}

export async function listExpenseCategories() {
  try {
    return await prisma.expenseCategory.findMany({
      orderBy: { name: "asc" },
    });
  } catch (err) {
    console.error("Error in listExpenseCategories:", err);
    return [];
  }
}

export async function listExpenses(params: ListExpensesParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where: Prisma.ExpenseWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.vendorId ? { vendorId: params.vendorId } : {}),
      ...(params.q
        ? {
            OR: [
              { number: { contains: params.q } },
              { description: { contains: params.q } },
              { referenceNumber: { contains: params.q } },
              { vendor: { businessName: { contains: params.q } } },
            ],
          }
        : {}),
    };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          category: { select: { id: true, name: true } },
          vendor: { select: { id: true, businessName: true } },
        },
      }),
      prisma.expense.count({ where }),
    ]);

    return { expenses, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listExpenses:", err);
    return { expenses: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function getExpenseDetail(id: string) {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        vendor: { select: { id: true, businessName: true } },
      },
    });
    if (!expense) return null;

    const activityLogs = await prisma.activityLog.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return { ...expense, activityLogs };
  } catch (err) {
    console.error("Error in getExpenseDetail:", err);
    return null;
  }
}

export function expenseToFormValues(expense: any): ExpenseFormValues {
  return {
    description: expense.description,
    categoryId: expense.categoryId,
    vendorId: expense.vendorId ?? "",
    date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : "",
    baseAmountPaise: expense.baseAmountPaise,
    gstRate: expense.gstRate,
    gstAmountPaise: expense.gstAmountPaise,
    totalAmountPaise: expense.totalAmountPaise,
    paymentMethod: expense.paymentMethod,
    referenceNumber: expense.referenceNumber ?? "",
    status: expense.status,
    notes: expense.notes ?? "",
  };
}

export async function createExpense(data: ExpenseFormValues, userId?: string) {
  const number = await generateExpenseNumber();

  const expense = await prisma.expense.create({
    data: {
      number,
      description: data.description,
      categoryId: data.categoryId,
      vendorId: data.vendorId || null,
      date: new Date(data.date),
      baseAmountPaise: data.baseAmountPaise,
      gstRate: data.gstRate,
      gstAmountPaise: data.gstAmountPaise,
      totalAmountPaise: data.totalAmountPaise,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber || null,
      status: data.status,
      notes: data.notes || null,
    },
    include: { category: { select: { name: true } } },
  });

  // Auto-accounting: Debit Expense + Input GST, Credit Cash/Bank
  if (expense.status === "RECORDED") {
    try {
      await prisma.$transaction(async (tx) => {
        await postExpenseJournal(expense, expense.category.name, userId, tx);
      });
    } catch (err) {
      console.warn("Auto-accounting for expense failed (non-fatal):", err);
    }
  }

  await logActivity({
    type: "expense.created",
    message: `Expense ${expense.number} recorded for ₹${(expense.totalAmountPaise / 100).toFixed(2)}`,
    entityType: "expense",
    entityId: expense.id,
    expenseId: expense.id,
    vendorId: expense.vendorId,
  });

  return expense;
}

export async function updateExpense(id: string, data: ExpenseFormValues) {
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      description: data.description,
      categoryId: data.categoryId,
      vendorId: data.vendorId || null,
      date: new Date(data.date),
      baseAmountPaise: data.baseAmountPaise,
      gstRate: data.gstRate,
      gstAmountPaise: data.gstAmountPaise,
      totalAmountPaise: data.totalAmountPaise,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber || null,
      status: data.status,
      notes: data.notes || null,
    },
  });

  await logActivity({
    type: "expense.updated",
    message: `Expense ${expense.number} updated`,
    entityType: "expense",
    entityId: expense.id,
    expenseId: expense.id,
    vendorId: expense.vendorId,
  });

  return expense;
}

export async function deleteExpense(id: string, userId?: string) {
  // Reverse accounting entry before deletion
  await prisma.$transaction(async (tx) => {
    await reverseExpenseJournal(id, `Expense deleted`, userId, tx);
  }).catch((err) => console.warn("Expense journal reversal failed (non-fatal):", err));

  return prisma.expense.delete({ where: { id } });
}

