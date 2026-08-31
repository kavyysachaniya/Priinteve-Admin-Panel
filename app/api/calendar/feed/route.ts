import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatIcalDate(date: Date, timeStr?: string | null): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  if (!timeStr) {
    return `${yyyy}${mm}${dd}`;
  }

  const [hh = "00", min = "00"] = timeStr.split(":");
  return `${yyyy}${mm}${dd}T${hh.padStart(2, "0")}${min.padStart(2, "0")}00Z`;
}

function escapeIcalText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET() {
  try {
    const now = new Date();
    const past = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const future = new Date(now.getFullYear(), now.getMonth() + 6, 1);

    const [events, tasks, deliveries, jobs] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: { startDate: { gte: past, lte: future } },
        include: { customer: { select: { name: true } } },
      }),
      prisma.task.findMany({
        where: { dueDate: { gte: past, lte: future } },
      }),
      prisma.delivery.findMany({
        where: { deliveryDate: { gte: past, lte: future } },
        include: { customer: { select: { name: true } } },
      }),
      prisma.productionJob.findMany({
        where: { expectedCompletionDate: { gte: past, lte: future } },
      }),
    ]);

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Priinteve//Priinteve Business Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Priinteve Admin Calendar",
      "X-WR-TIMEZONE:UTC",
      "X-WR-CALDESC:Real-time sync of Priinteve events, order deadlines, and deliveries.",
    ];

    // Calendar Events
    for (const e of events) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:event-${e.id}@priinteve.com`);
      lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
      lines.push(`DTSTART:${formatIcalDate(e.startDate, e.startTime)}`);
      lines.push(`DTEND:${formatIcalDate(e.endDate || e.startDate, e.endTime || e.startTime)}`);
      lines.push(`SUMMARY:${escapeIcalText(e.title)}`);
      if (e.description) {
        lines.push(`DESCRIPTION:${escapeIcalText(e.description)}`);
      }
      lines.push("END:VEVENT");
    }

    // Tasks
    for (const t of tasks) {
      if (t.dueDate) {
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:task-${t.id}@priinteve.com`);
        lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
        lines.push(`DTSTART:${formatIcalDate(t.dueDate, t.dueTime)}`);
        lines.push(`DTEND:${formatIcalDate(t.dueDate, t.dueTime)}`);
        lines.push(`SUMMARY:${escapeIcalText(`[Task] ${t.title}`)}`);
        lines.push(`DESCRIPTION:Priority: ${t.priority}, Status: ${t.status}`);
        lines.push("END:VEVENT");
      }
    }

    // Deliveries
    for (const d of deliveries) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:delivery-${d.id}@priinteve.com`);
      lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
      lines.push(`DTSTART:${formatIcalDate(d.deliveryDate)}`);
      lines.push(`DTEND:${formatIcalDate(d.deliveryDate)}`);
      lines.push(`SUMMARY:${escapeIcalText(`[Delivery] ${d.number} - ${d.customer?.name || "Customer"}`)}`);
      lines.push(`DESCRIPTION:Delivery Status: ${d.status}, Tracking: ${d.trackingNumber || "N/A"}`);
      lines.push("END:VEVENT");
    }

    // Production Jobs
    for (const j of jobs) {
      if (j.expectedCompletionDate) {
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:job-${j.id}@priinteve.com`);
        lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
        lines.push(`DTSTART:${formatIcalDate(j.expectedCompletionDate)}`);
        lines.push(`DTEND:${formatIcalDate(j.expectedCompletionDate)}`);
        lines.push(`SUMMARY:${escapeIcalText(`[Production Due] Job ${j.number} - ${j.itemName}`)}`);
        lines.push(`DESCRIPTION:Quantity: ${j.quantity}, Priority: ${j.priority}, Stage: ${j.status}`);
        lines.push("END:VEVENT");
      }
    }

    lines.push("END:VCALENDAR");

    const icalContent = lines.join("\r\n");

    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="priinteve-calendar.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Error generating calendar feed:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
