import { z } from "zod";
import { GROUPS, PRESETS, isDateKey } from "@/lib/timesheet";

const id = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/);
const dateKey = z.string().trim().refine(isDateKey, "Use YYYY-MM-DD");

/** Query parameters of /timesheet and /api/timesheet/export. Anything invalid falls back to a default. */
export const timesheetQuerySchema = z.object({
  preset: z.enum(PRESETS).catch("this_week"),
  from: dateKey.optional().catch(undefined),
  to: dateKey.optional().catch(undefined),
  group: z.enum(GROUPS).catch("task"),
  user: id.optional().catch(undefined),
  project: id.optional().catch(undefined),
  task: id.optional().catch(undefined),
});

export type TimesheetQuery = z.infer<typeof timesheetQuerySchema>;

/** Reads a Next.js searchParams object (values may be arrays) into a validated query. */
export function parseTimesheetQuery(raw: Record<string, string | string[] | undefined>): TimesheetQuery {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return timesheetQuerySchema.parse({
    preset: first(raw.preset),
    from: first(raw.from),
    to: first(raw.to),
    group: first(raw.group),
    user: first(raw.user),
    project: first(raw.project),
    task: first(raw.task),
  });
}
