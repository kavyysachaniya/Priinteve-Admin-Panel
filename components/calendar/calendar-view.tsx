"use client";

import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export function CalendarView({ initialEvents = [] }: { initialEvents: any[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{format(currentDate, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="size-4" />
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
          const dayEvents = initialEvents.filter((e) => isSameDay(new Date(e.date), day));
          return (
            <div
              key={day.toISOString()}
              className={`bg-card p-2 min-h-[100px] flex flex-col justify-between ${
                !isSameMonth(day, currentDate) ? "opacity-40" : ""
              }`}
            >
              <div className="font-semibold text-right text-muted-foreground">{format(day, "d")}</div>
              <div className="space-y-1 mt-1 flex-1">
                {dayEvents.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] truncate font-medium"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

