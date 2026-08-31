"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EventFormDialog, type CalendarEventEditTarget } from "@/components/calendar/event-form-dialog";
import { deleteCalendarEventAction } from "@/lib/actions/calendar";
import type { ComboboxCustomer } from "@/components/shared/customer-combobox";

export function CalendarEventActions({
  event,
  customers,
  orders,
  tasks,
}: {
  event: CalendarEventEditTarget;
  customers: ComboboxCustomer[];
  orders: Array<{ id: string; number: string }>;
  tasks: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 print-hide">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="size-3.5" /> Edit
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3.5" /> Delete
          </Button>
        }
        title="Delete this event?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await deleteCalendarEventAction(event.id);
          if (result.success) router.push("/calendar");
          return result;
        }}
      />

      {editOpen && (
        <EventFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          customers={customers}
          orders={orders}
          tasks={tasks}
          event={event}
        />
      )}
    </div>
  );
}
