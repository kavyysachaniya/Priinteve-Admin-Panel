import { z } from "zod";

export const calendarEventFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional().default(""),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
  customerId: z.string().optional().default(""),
  orderId: z.string().optional().default(""),
  taskId: z.string().optional().default(""),
});

export type CalendarEventFormValues = z.infer<typeof calendarEventFormSchema>;

export function calendarEventFormDefaults(overrides?: Partial<CalendarEventFormValues>): CalendarEventFormValues {
  return {
    title: "",
    description: "",
    startDate: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endDate: "",
    endTime: "",
    customerId: "",
    orderId: "",
    taskId: "",
    ...overrides,
  };
}

