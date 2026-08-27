export const dynamic = "force-dynamic";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/shared/page-header";
import { listCalendarEvents } from "@/lib/services/calendar";

export const metadata = { title: "Calendar — Priinteve Business OS" };

export default async function CalendarPage() {
  const events = await listCalendarEvents({});
  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Visual schedule of print orders, tasks, and company events." />
      <CalendarView initialEvents={events} />
    </div>
  );
}

