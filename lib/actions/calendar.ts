"use server";

import { revalidatePath } from "next/cache";
import * as calendarService from "@/lib/services/calendar";
import { calendarEventFormSchema, type CalendarEventFormValues } from "@/lib/validations/calendar";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";

export async function createCalendarEventAction(values: CalendarEventFormValues): Promise<FormActionResult> {
  await requirePermission("calendar:create");
  const parsed = calendarEventFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const event = await calendarService.createCalendarEvent(parsed.data);
    revalidatePath("/calendar");
    return { success: true, id: event.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateCalendarEventAction(id: string, values: CalendarEventFormValues): Promise<FormActionResult> {
  await requirePermission("calendar:create");
  const parsed = calendarEventFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await calendarService.updateCalendarEvent(id, parsed.data);
    revalidatePath("/calendar");
    revalidatePath(`/calendar/event/${id}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteCalendarEventAction(id: string) {
  await requirePermission("calendar:create");
  try {
    await calendarService.deleteCalendarEvent(id);
    revalidatePath("/calendar");
    return { success: true as const, message: "Event deleted" };
  } catch (err) {
    return { success: false as const, message: friendlyError(err) };
  }
}
