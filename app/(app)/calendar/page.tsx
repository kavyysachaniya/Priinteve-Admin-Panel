export const dynamic = "force-dynamic";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/shared/page-header";
import { GoogleCalendarSyncDialog } from "@/components/calendar/google-calendar-sync-dialog";
import { getCalendarItemsForRange } from "@/lib/services/calendar";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { listOrdersForPicker } from "@/lib/services/orders";
import { listTasksForPicker } from "@/lib/services/tasks";

export const metadata = { title: "Calendar — Priinteve Business OS" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "week" ? "week" : "month";
  const currentDate = params.date ? new Date(params.date) : new Date();

  const rangeStart = view === "month" ? startOfWeek(startOfMonth(currentDate)) : startOfWeek(currentDate);
  const rangeEnd = view === "month" ? endOfWeek(endOfMonth(currentDate)) : endOfWeek(currentDate);

  // Pre-compute the adjacent-period dates server-side so client nav is a plain link, not client-side date math.
  const prevDate = view === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1);
  const nextDate = view === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1);

  const [events, customers, orders, tasks] = await Promise.all([
    getCalendarItemsForRange(rangeStart, rangeEnd),
    listAllActiveCustomers(),
    listOrdersForPicker(),
    listTasksForPicker(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Visual schedule of print orders, tasks, deliveries, and company events."
        actions={<GoogleCalendarSyncDialog />}
      />
      <CalendarView
        events={events}
        view={view}
        currentDate={currentDate.toISOString()}
        rangeStart={rangeStart.toISOString()}
        rangeEnd={rangeEnd.toISOString()}
        prevDate={prevDate.toISOString()}
        nextDate={nextDate.toISOString()}
        customers={customers}
        orders={orders.map((o) => ({ id: o.id, number: o.number }))}
        tasks={tasks}
      />
    </div>
  );
}
