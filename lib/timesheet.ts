import { zonedDay } from "@/lib/services/companion/time";

// Pure helpers for the timesheet: date-range presets in the business time zone, and the
// aggregation of time entries into groups. No database access, so they're tested offline
// (scripts/test-timesheet.ts).

export const TIMESHEET_TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";
export const MAX_RANGE_DAYS = 366;

export const PRESETS = ["today", "this_week", "last_week", "this_month", "last_month", "this_year", "custom"] as const;
export type Preset = (typeof PRESETS)[number];

export const PRESET_LABELS: Record<Preset, string> = {
  today: "Today",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
  this_year: "This year",
  custom: "Custom",
};

export const GROUPS = ["task", "project", "person", "day"] as const;
export type GroupBy = (typeof GROUPS)[number];

export interface DateRange {
  /** First day, YYYY-MM-DD in the business zone (inclusive). */
  fromKey: string;
  /** Last day, YYYY-MM-DD (inclusive). */
  toKey: string;
  /** Instant the range starts (inclusive) and ends (exclusive). */
  from: Date;
  to: Date;
  days: number;
}

const DAY_MS = 86_400_000;
const utcDay = (key: string) => Date.parse(`${key}T00:00:00Z`);
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(utcDay(value));

/** The instant a calendar day (YYYY-MM-DD) starts in the zone. */
function startOfDayKey(key: string, tz: string, now: Date): Date {
  const todayKey = zonedDay(tz, 0, now).key;
  return zonedDay(tz, Math.round((utcDay(key) - utcDay(todayKey)) / DAY_MS), now).start;
}

function rangeFromKeys(fromKey: string, toKeyInclusive: string, tz: string, now: Date): DateRange {
  const from = startOfDayKey(fromKey, tz, now);
  const to = startOfDayKey(toKey(utcDay(toKeyInclusive) + DAY_MS), tz, now);
  return { fromKey, toKey: toKeyInclusive, from, to, days: Math.round((utcDay(toKeyInclusive) - utcDay(fromKey)) / DAY_MS) + 1 };
}

/**
 * Resolves a preset (or a custom from/to) to a concrete range in the business time zone.
 * Weeks start on Monday. A custom range is swapped if reversed and capped at 366 days.
 */
export function resolveRange(
  preset: Preset,
  custom: { from?: string; to?: string } = {},
  now = new Date(),
  tz = TIMESHEET_TZ,
): DateRange {
  const today = zonedDay(tz, 0, now).key;
  const t = new Date(utcDay(today));
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const weekday = (t.getUTCDay() + 6) % 7; // Monday = 0

  switch (preset) {
    case "today":
      return rangeFromKeys(today, today, tz, now);
    case "this_week": {
      const start = utcDay(today) - weekday * DAY_MS;
      return rangeFromKeys(toKey(start), toKey(start + 6 * DAY_MS), tz, now);
    }
    case "last_week": {
      const start = utcDay(today) - (weekday + 7) * DAY_MS;
      return rangeFromKeys(toKey(start), toKey(start + 6 * DAY_MS), tz, now);
    }
    case "this_month":
      return rangeFromKeys(toKey(Date.UTC(y, m, 1)), toKey(Date.UTC(y, m + 1, 0)), tz, now);
    case "last_month":
      return rangeFromKeys(toKey(Date.UTC(y, m - 1, 1)), toKey(Date.UTC(y, m, 0)), tz, now);
    case "this_year":
      return rangeFromKeys(`${y}-01-01`, `${y}-12-31`, tz, now);
    case "custom": {
      let from = custom.from && isDateKey(custom.from) ? custom.from : today;
      let to = custom.to && isDateKey(custom.to) ? custom.to : from;
      if (utcDay(from) > utcDay(to)) [from, to] = [to, from];
      if ((utcDay(to) - utcDay(from)) / DAY_MS + 1 > MAX_RANGE_DAYS) to = toKey(utcDay(from) + (MAX_RANGE_DAYS - 1) * DAY_MS);
      return rangeFromKeys(from, to, tz, now);
    }
  }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface TimesheetEntry {
  id: string;
  userId: string | null;
  userName: string;
  projectId: string;
  projectName: string;
  taskId: string | null;
  taskTitle: string | null;
  description: string | null;
  startedAt: Date;
  endedAt: Date | null;
  running: boolean;
  seconds: number;
}

export interface TimesheetGroup {
  key: string;
  label: string;
  seconds: number;
  entries: number;
  /** 0..1 share of the total. */
  share: number;
}

export function dayKeyInZone(date: Date, tz = TIMESHEET_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function groupEntries(entries: TimesheetEntry[], by: GroupBy, tz = TIMESHEET_TZ): TimesheetGroup[] {
  const map = new Map<string, { label: string; seconds: number; entries: number }>();
  for (const e of entries) {
    let key: string;
    let label: string;
    switch (by) {
      case "task":
        key = e.taskId ?? `none:${e.projectId}`;
        label = e.taskTitle ?? `${e.projectName} (no task)`;
        break;
      case "project":
        key = e.projectId;
        label = e.projectName;
        break;
      case "person":
        key = e.userId ?? "unknown";
        label = e.userName;
        break;
      case "day":
        key = dayKeyInZone(e.startedAt, tz);
        label = key;
        break;
    }
    const row = map.get(key) ?? { label, seconds: 0, entries: 0 };
    row.seconds += e.seconds;
    row.entries += 1;
    map.set(key, row);
  }
  const total = [...map.values()].reduce((s, r) => s + r.seconds, 0);
  const groups = [...map.entries()].map(([key, r]) => ({ key, ...r, share: total > 0 ? r.seconds / total : 0 }));
  // Days read chronologically; everything else by time spent.
  return by === "day" ? groups.sort((a, b) => a.key.localeCompare(b.key)) : groups.sort((a, b) => b.seconds - a.seconds);
}

/** Hours as h:mm (e.g. 5400 s -> "1:30"), the usual timesheet format. */
export function formatHoursMinutes(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
