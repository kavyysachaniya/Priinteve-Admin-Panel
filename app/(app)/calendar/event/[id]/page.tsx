export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCalendarEventDetail } from "@/lib/services/calendar";
import { listAllActiveCustomers } from "@/lib/services/customers";
import { listOrdersForPicker } from "@/lib/services/orders";
import { listTasksForPicker } from "@/lib/services/tasks";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarEventActions } from "@/components/calendar/calendar-event-actions";
import { format } from "date-fns";

export const metadata = { title: "Calendar Event Details — Priinteve Business OS" };

export default async function CalendarEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, customers, orders, tasks] = await Promise.all([
    getCalendarEventDetail(id),
    listAllActiveCustomers(),
    listOrdersForPicker(),
    listTasksForPicker(),
  ]);
  if (!event) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={event.title}
        description="Scheduled Event Details"
        backHref="/calendar"
        actions={
          <CalendarEventActions
            event={{
              id: event.id,
              title: event.title,
              description: event.description,
              startDate: event.startDate,
              startTime: event.startTime,
              endDate: event.endDate,
              endTime: event.endTime,
              customerId: event.customerId,
              orderId: event.orderId,
              taskId: event.taskId,
            }}
            customers={customers}
            orders={orders.map((o) => ({ id: o.id, number: o.number }))}
            tasks={tasks}
          />
        }
      />
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
        {(event.customer || event.order || event.task) && (
          <div className="pt-3 border-t space-y-2">
            <span className="text-muted-foreground text-xs">Related Records:</span>
            <div className="flex flex-wrap gap-2 text-xs">
              {event.customer && (
                <Link href={`/customers/${event.customer.id}`} className="rounded-md border px-2.5 py-1 font-medium text-primary hover:underline">
                  {event.customer.name}
                </Link>
              )}
              {event.order && (
                <Link href={`/orders/${event.order.id}`} className="rounded-md border px-2.5 py-1 font-medium text-primary hover:underline">
                  Order {event.order.number}
                </Link>
              )}
              {event.task && (
                <Link href={`/tasks/${event.task.id}`} className="rounded-md border px-2.5 py-1 font-medium text-primary hover:underline">
                  Task: {event.task.title}
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
