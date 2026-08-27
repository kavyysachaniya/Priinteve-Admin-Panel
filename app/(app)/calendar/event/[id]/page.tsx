export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getCalendarEventDetail } from "@/lib/services/calendar";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

export const metadata = { title: "Calendar Event Details — Priinteve Business OS" };

export default async function CalendarEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getCalendarEventDetail(id);
  if (!event) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={event.title} description="Scheduled Event Details" />
      <Card className="p-6 space-y-4">
        <div>
          <span className="text-muted-foreground text-xs">Date & Time:</span>
          <p className="font-semibold text-sm">
            {format(new Date(event.startDate), "PPP")} {event.startTime ? `@ ${event.startTime}` : ""}
          </p>
        </div>
        {event.description && (
          <div>
            <span className="text-muted-foreground text-xs">Description:</span>
            <p className="text-xs whitespace-pre-wrap">{event.description}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
