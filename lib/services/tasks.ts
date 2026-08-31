import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import type { TaskFormValues } from "@/lib/validations/task";
import type { Prisma, Task, TaskPriority, TaskStatus } from "@prisma/client";

const PAGE_SIZE = 15;

export interface ListTasksParams {
  q?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: string;
  customerId?: string;
  orderId?: string;
  invoiceId?: string;
  page?: number;
}

/** A lightweight, uncompleted-tasks list for "link a task" selects (calendar events). */
export async function listTasksForPicker() {
  return prisma.task.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    orderBy: { dueDate: "asc" },
    take: 100,
    select: { id: true, title: true },
  });
}

export async function listTasks(params: ListTasksParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let dueDateWhere: Prisma.DateTimeFilter | undefined;
    if (params.dueDate === "today") {
      dueDateWhere = { gte: todayStart, lte: todayEnd };
    } else if (params.dueDate === "overdue") {
      dueDateWhere = { lt: todayStart };
    } else if (params.dueDate === "upcoming") {
      dueDateWhere = { gt: todayEnd };
    } else if (params.dueDate && params.dueDate.length === 10) {
      const d = new Date(params.dueDate);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      dueDateWhere = { gte: start, lte: end };
    }

    const where: Prisma.TaskWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(dueDateWhere ? { dueDate: dueDateWhere } : {}),
      ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.orderId ? { orderId: params.orderId } : {}),
      ...(params.invoiceId ? { invoiceId: params.invoiceId } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q } },
              { description: { contains: params.q } },
            ],
          }
        : {}),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [
          { status: "asc" },
          { dueDate: "asc" },
          { priority: "desc" },
        ],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          assignedTo: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          order: { select: { id: true, number: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return { tasks, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listTasks:", err);
    return { tasks: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export type TaskListItem = Prisma.TaskGetPayload<{
  include: {
    assignedTo: { select: { id: true; name: true } };
    customer: { select: { id: true; name: true } };
    order: { select: { id: true; number: true } };
  };
}>;

export async function getTaskDetail(id: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        order: { select: { id: true, number: true } },
        quotation: { select: { id: true, number: true } },
        invoice: { select: { id: true, number: true } },
        productionJob: { select: { id: true, number: true, itemName: true } },
        activityLogs: { orderBy: { createdAt: "desc" } },
      },
    });
    return task;
  } catch (err) {
    console.error("Error in getTaskDetail:", err);
    return null;
  }
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export function taskToFormValues(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
    dueTime: task.dueTime ?? "",
    assignedToId: task.assignedToId ?? "",
    customerId: task.customerId ?? "",
    orderId: task.orderId ?? "",
    quotationId: task.quotationId ?? "",
    invoiceId: task.invoiceId ?? "",
    productionJobId: task.productionJobId ?? "",
    tags: task.tags ?? "",
    reminder: task.reminder ? new Date(task.reminder).toISOString().slice(0, 16) : "",
  };
}

export async function createTask(data: TaskFormValues) {
  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      dueTime: data.dueTime || null,
      assignedToId: data.assignedToId && data.assignedToId !== "unassigned" ? data.assignedToId : null,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      quotationId: data.quotationId || null,
      invoiceId: data.invoiceId || null,
      productionJobId: data.productionJobId || null,
      tags: data.tags || null,
      reminder: data.reminder ? new Date(data.reminder) : null,
    },
  });

  await logActivity({
    type: "task.created",
    message: `Task created: "${task.title}"`,
    entityType: "task",
    entityId: task.id,
    customerId: task.customerId ?? undefined,
    orderId: task.orderId ?? undefined,
  });

  return task;
}

export async function updateTask(id: string, data: TaskFormValues) {
  const task = await prisma.task.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      dueTime: data.dueTime || null,
      assignedToId: data.assignedToId && data.assignedToId !== "unassigned" ? data.assignedToId : null,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      quotationId: data.quotationId || null,
      invoiceId: data.invoiceId || null,
      productionJobId: data.productionJobId || null,
      tags: data.tags || null,
      reminder: data.reminder ? new Date(data.reminder) : null,
    },
  });

  await logActivity({
    type: "task.updated",
    message: `Task updated: "${task.title}"`,
    entityType: "task",
    entityId: task.id,
    customerId: task.customerId ?? undefined,
    orderId: task.orderId ?? undefined,
  });

  return task;
}

export async function toggleTaskStatus(id: string) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Task not found");

  const nextStatus: TaskStatus = existing.status === "COMPLETED" ? "TODO" : "COMPLETED";
  const updated = await prisma.task.update({
    where: { id },
    data: { status: nextStatus },
  });

  await logActivity({
    type: "task.status_changed",
    message: `Task status changed to ${nextStatus}`,
    entityType: "task",
    entityId: updated.id,
    customerId: updated.customerId ?? undefined,
    orderId: updated.orderId ?? undefined,
  });

  return updated;
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

