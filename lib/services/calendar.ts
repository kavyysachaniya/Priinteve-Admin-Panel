import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import type { CalendarEventFormValues } from "@/lib/validations/calendar";

export interface CalendarItem {
  id: string;
  type: "event" | "task" | "delivery" | "production" | "invoice";
  title: string;
  date: Date;
  time?: string | null;
  status?: string;
  priority?: string;
  href: string;
}

export async function listCalendarEvents(params: { startDate?: Date; endDate?: Date }) {
  const start = params.startDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = params.endDate ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  return getCalendarItemsForRange(start, end);
}

export async function getCalendarItemsForRange(startDate: Date, endDate: Date): Promise<CalendarItem[]> {
  const [events, tasks, deliveries, jobs, invoices] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { startDate: { gte: startDate, lte: endDate } },
      include: { customer: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { dueDate: { gte: startDate, lte: endDate } },
    }),
    prisma.delivery.findMany({
      where: { deliveryDate: { gte: startDate, lte: endDate } },
      include: { customer: { select: { name: true } } },
    }),
    prisma.productionJob.findMany({
      where: { expectedCompletionDate: { gte: startDate, lte: endDate } },
    }),
    prisma.invoice.findMany({
      where: { dueDate: { gte: startDate, lte: endDate }, status: { not: "PAID" } },
    }),
  ]);

  const items: CalendarItem[] = [];

  for (const e of events) {
    items.push({
      id: e.id,
      type: "event",
      title: e.title,
      date: e.startDate,
      time: e.startTime,
      href: `/calendar/event/${e.id}`,
    });
  }

  for (const t of tasks) {
    if (t.dueDate) {
      items.push({
        id: t.id,
        type: "task",
        title: `Task: ${t.title}`,
        date: t.dueDate,
        time: t.dueTime,
        status: t.status,
        priority: t.priority,
        href: `/tasks/${t.id}`,
      });
    }
  }

  for (const d of deliveries) {
    items.push({
      id: d.id,
      type: "delivery",
      title: `Delivery ${d.number} (${d.customer.name})`,
      date: d.deliveryDate,
      status: d.status,
      href: `/deliveries/${d.id}`,
    });
  }

  for (const j of jobs) {
    if (j.expectedCompletionDate) {
      items.push({
        id: j.id,
        type: "production",
        title: `Prod Job ${j.number} Due`,
        date: j.expectedCompletionDate,
        status: j.status,
        priority: j.priority,
        href: `/production/${j.id}`,
      });
    }
  }

  for (const inv of invoices) {
    items.push({
      id: inv.id,
      type: "invoice",
      title: `Invoice ${inv.number} Due`,
      date: inv.dueDate,
      status: inv.status,
      href: `/invoices/${inv.id}`,
    });
  }

  return items;
}

export async function getCalendarEventDetail(id: string) {
  return prisma.calendarEvent.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

export async function createCalendarEvent(data: CalendarEventFormValues) {
  const event = await prisma.calendarEvent.create({
    data: {
      title: data.title,
      description: data.description || null,
      startDate: new Date(data.startDate),
      startTime: data.startTime || null,
      endDate: data.endDate ? new Date(data.endDate) : new Date(data.startDate),
      endTime: data.endTime || null,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      taskId: data.taskId || null,
    },
  });

  await logActivity({
    type: "calendar_event.created",
    message: `Calendar event scheduled: "${event.title}"`,
    entityType: "calendar_event",
    entityId: event.id,
  });

  return event;
}

export async function updateCalendarEvent(id: string, data: CalendarEventFormValues) {
  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description || null,
      startDate: new Date(data.startDate),
      startTime: data.startTime || null,
      endDate: data.endDate ? new Date(data.endDate) : new Date(data.startDate),
      endTime: data.endTime || null,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      taskId: data.taskId || null,
    },
  });

  return event;
}

export async function deleteCalendarEvent(id: string) {
  return prisma.calendarEvent.delete({ where: { id } });
}

export async function getPlannerDataForDate(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const [tasks, events, orders, deliveries, notes] = await Promise.all([
    prisma.task.findMany({
      where: { dueDate: { gte: start, lte: end } },
      include: { customer: { select: { id: true, name: true } }, order: { select: { id: true, number: true } } },
    }),
    prisma.calendarEvent.findMany({
      where: { startDate: { gte: start, lte: end } },
    }),
    prisma.order.findMany({
      where: { expectedCompletionDate: { gte: start, lte: end } },
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.delivery.findMany({
      where: { deliveryDate: { gte: start, lte: end } },
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.note.findMany({
      where: { pinned: true },
      take: 5,
    }),
  ]);

  return { tasks, events, orders, deliveries, notes };
}

