"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EventFormDialog, type CalendarEventEditTarget } from "@/components/calendar/event-form-dialog";
import type { ComboboxCustomer } from "@/components/shared/customer-combobox";
import type { CalendarItem } from "@/lib/services/calendar";

const TYPE_STYLES: Record<CalendarItem["type"], string> = {
  event: "bg-primary/10 hover:bg-primary/20 text-primary",
  task: "bg-[color-mix(in_oklch,var(--chart-2),transparent_85%)] hover:bg-[color-mix(in_oklch,var(--chart-2),transparent_75%)] text-[var(--chart-2)]",
  delivery: "bg-[color-mix(in_oklch,var(--chart-3),transparent_85%)] hover:bg-[color-mix(in_oklch,var(--chart-3),transparent_75%)] text-[var(--chart-3)]",
  production: "bg-[color-mix(in_oklch,var(--chart-5),transparent_85%)] hover:bg-[color-mix(in_oklch,var(--chart-5),transparent_75%)] text-[var(--chart-5)]",
  invoice: "bg-destructive/10 hover:bg-destructive/20 text-destructive",
};

const MAX_VISIBLE_PER_DAY = 3;

export function CalendarView({
  events,
  view,
  currentDate,
  rangeStart,
  rangeEnd,
  prevDate,
  nextDate,
  customers,
  orders,
  tasks,
}: {
  events: CalendarItem[];
  view: "month" | "week";
  currentDate: string;
  rangeStart: string;
  rangeEnd: string;
  prevDate: string;
  nextDate: string;
  customers: ComboboxCustomer[];
  orders: Array<{ id: string; number: string }>;
  tasks: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [dialogTarget, setDialogTarget] = useState<{ defaultDate?: string; event?: CalendarEventEditTarget } | null>(null);

  const current = new Date(currentDate);
  const days = eachDayOfInterval({ start: new Date(rangeStart), end: new Date(rangeEnd) });

  function navigate(dateIso: string, nextView: "month" | "week" = view) {
    router.push(`/calendar?date=${dateIso.slice(0, 10)}&view=${nextView}`);
  }

  function openCreateDialog(date: Date) {
    setDialogTarget({ defaultDate: format(date, "yyyy-MM-dd") });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">
          {view === "month" ? format(current, "MMMM yyyy") : `Week of ${format(new Date(rangeStart), "d MMM yyyy")}`}
        </h2>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => navigate(currentDate, v as "month" | "week")}>
            <TabsList variant="line">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" onClick={() => navigate(prevDate)} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(new Date().toISOString())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(nextDate)} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" onClick={() => openCreateDialog(new Date())}>
            <Plus className="size-4" /> Add Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="bg-muted p-2 text-center font-bold text-muted-foreground">
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dayItems = events.filter((e) => isSameDay(new Date(e.date), day));
          const visible = view === "week" ? dayItems : dayItems.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayItems.length - visible.length;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "group relative bg-card p-2 flex flex-col justify-between",
                view === "month" ? "min-h-[100px]" : "min-h-[220px]",
                !isSameMonth(day, current) && view === "month" && "opacity-40"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-semibold text-muted-foreground",
                    isToday(day) && "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                <button
                  onClick={() => openCreateDialog(day)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                  aria-label="Add event on this day"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="space-y-1 mt-1 flex-1">
                {visible.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.href}
                    className={cn("block p-1 rounded truncate font-medium", TYPE_STYLES[item.type])}
                  >
                    {item.title}
                  </Link>
                ))}
                {overflow > 0 && (
                  <button
                    onClick={() => openCreateDialog(day)}
                    className="text-[10px] text-muted-foreground hover:text-foreground pl-1"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {dialogTarget && (
        <EventFormDialog
          key={dialogTarget.event?.id ?? dialogTarget.defaultDate ?? "new"}
          open={Boolean(dialogTarget)}
          onOpenChange={(open) => !open && setDialogTarget(null)}
          customers={customers}
          orders={orders}
          tasks={tasks}
          event={dialogTarget.event}
          defaultDate={dialogTarget.defaultDate}
        />
      )}
    </div>
  );
}
