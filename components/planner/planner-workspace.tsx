"use client";

import { useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, CheckSquare, Calendar, Factory, Truck, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function PlannerWorkspace({ initialDate, data }: { initialDate: string; data: any }) {
  const [selectedDate, setSelectedDate] = useState(new Date(initialDate));

  const prevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const nextDay = () => setSelectedDate(addDays(selectedDate, 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <Calendar className="size-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">{format(selectedDate, "EEEE, d MMMM yyyy")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevDay}>
            <ChevronLeft className="size-4 mr-1" /> Previous Day
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextDay}>
            Next Day <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckSquare className="size-4 text-blue-500" /> Operational Tasks ({data.tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data.tasks.length === 0 ? (
              <p className="text-muted-foreground italic">No tasks scheduled for today.</p>
            ) : (
              data.tasks.map((task: any) => (
                <div key={task.id} className="p-2.5 rounded border bg-muted/20 flex justify-between items-center">
                  <Link href={`/tasks/${task.id}`} className="font-semibold text-foreground hover:underline">
                    {task.title}
                  </Link>
                  <span className="text-[11px] text-muted-foreground">{task.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Factory className="size-4 text-amber-500" /> Print Orders Due ({data.orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data.orders.length === 0 ? (
              <p className="text-muted-foreground italic">No print orders completion due today.</p>
            ) : (
              data.orders.map((order: any) => (
                <div key={order.id} className="p-2.5 rounded border bg-muted/20 flex justify-between items-center">
                  <div>
                    <Link href={`/orders/${order.id}`} className="font-bold text-primary hover:underline">
                      {order.number}
                    </Link>
                    <span className="text-muted-foreground ml-2">({order.customer.name})</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{order.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Truck className="size-4 text-purple-500" /> Deliveries Scheduled ({data.deliveries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data.deliveries.length === 0 ? (
              <p className="text-muted-foreground italic">No deliveries scheduled for today.</p>
            ) : (
              data.deliveries.map((del: any) => (
                <div key={del.id} className="p-2.5 rounded border bg-muted/20 flex justify-between items-center">
                  <div>
                    <Link href={`/deliveries/${del.id}`} className="font-bold text-primary hover:underline">
                      {del.number}
                    </Link>
                    <span className="text-muted-foreground ml-2">({del.customer.name})</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{del.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <StickyNote className="size-4 text-emerald-500" /> Pinned Operational Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data.notes.length === 0 ? (
              <p className="text-muted-foreground italic">No pinned notes.</p>
            ) : (
              data.notes.map((note: any) => (
                <div key={note.id} className="p-2.5 rounded border bg-muted/20">
                  <Link href={`/notes/${note.id}`} className="font-bold text-foreground hover:underline block mb-1">
                    {note.title}
                  </Link>
                  <p className="text-muted-foreground line-clamp-2">{note.content}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

