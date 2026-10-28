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

/** Entry filters on the timesheet: "attention" = flagged (>12 h), interrupted or corrected. */
export const ENTRY_FILTERS = ["all", "running", "completed", "attention"] as const;
export type EntryFilter = (typeof ENTRY_FILTERS)[number];
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

/** A calendar month ("YYYY-MM") as a range in the business time zone. */
export const isMonthKey = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function monthRange(month: string, now = new Date(), tz = TIMESHEET_TZ): DateRange {
  const [y, m] = month.split("-").map(Number);
  return rangeFromKeys(toKey(Date.UTC(y, m - 1, 1)), toKey(Date.UTC(y, m, 0)), tz, now);
}

/** "YYYY-MM" of the month `now` falls in, in the business time zone. */
export function currentMonthKey(now = new Date(), tz = TIMESHEET_TZ): string {
  return zonedDay(tz, 0, now).key.slice(0, 7);
}

// ---------------------------------------------------------------------------
// Clipping to a range and splitting at midnight
// ---------------------------------------------------------------------------
//
// A time entry is one segment of work with stored start/end timestamps and its worked seconds
// (paused gaps are already separate segments). A segment that crosses midnight or a month end is
// split at the boundary in the business time zone; the stored timestamps are never changed.

export interface Segment {
  startedAt: Date;
  /** null while it runs; it counts up to `now`. */
  endedAt: Date | null;
  /** Worked seconds recorded for the whole segment. */
  seconds: number;
}

/** Fraction of [start, end) that falls in [from, to). */
function overlapShare(start: number, end: number, from: number, to: number): number {
  if (end <= start) return start >= from && start < to ? 1 : 0;
  const overlap = Math.min(end, to) - Math.max(start, from);
  return overlap <= 0 ? 0 : Math.min(1, overlap / (end - start));
}

/** Worked seconds of a segment that fall inside [from, to). */
export function secondsInRange(segment: Segment, from: Date, to: Date, now = new Date()): number {
  const end = (segment.endedAt ?? now).getTime();
  const share = overlapShare(segment.startedAt.getTime(), end, from.getTime(), to.getTime());
  return share >= 1 ? segment.seconds : Math.round(segment.seconds * share);
}

export interface DayPart {
  /** YYYY-MM-DD in the business zone. */
  key: string;
  seconds: number;
}

/**
 * Splits a segment's worked seconds across the calendar days it touches (business zone).
 * The parts always add up to the segment's seconds.
 */
export function splitByDay(segment: Segment, now = new Date(), tz = TIMESHEET_TZ): DayPart[] {
  const start = segment.startedAt.getTime();
  const end = (segment.endedAt ?? now).getTime();
  const firstKey = dayKeyInZone(segment.startedAt, tz);
  const lastKey = dayKeyInZone(new Date(Math.max(start, end - 1)), tz);
  if (firstKey === lastKey) return [{ key: firstKey, seconds: segment.seconds }];

  const parts: DayPart[] = [];
  let assigned = 0;
  for (let key = firstKey; ; key = toKey(utcDay(key) + DAY_MS)) {
    const isLast = key === lastKey;
    const from = startOfDayKey(key, tz, now).getTime();
    const to = startOfDayKey(toKey(utcDay(key) + DAY_MS), tz, now).getTime();
    const seconds = isLast ? segment.seconds - assigned : Math.round(segment.seconds * overlapShare(start, end, from, to));
    assigned += seconds;
    parts.push({ key, seconds });
    if (isLast || parts.length > 400) break;
  }
  return parts;
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
  /** Worked seconds inside the selected range (a segment crossing the range edge is clipped). */
  seconds: number;
  /** The same seconds split by calendar day, inside the range. */
  days?: DayPart[];
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
      case "day": {
        // A segment that crosses midnight counts on each day it touches.
        for (const part of e.days ?? [{ key: dayKeyInZone(e.startedAt, tz), seconds: e.seconds }]) {
          const row = map.get(part.key) ?? { label: part.key, seconds: 0, entries: 0 };
          row.seconds += part.seconds;
          row.entries += 1;
          map.set(part.key, row);
        }
        continue;
      }
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

/** Seconds as HH:MM:SS (hours not capped at 24). */
export function formatHms(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Seconds as decimal hours with 4 places, for spreadsheet maths. */
export function decimalHours(seconds: number): number {
  return Math.round((Math.max(0, seconds) / 3600) * 10_000) / 10_000;
}

/** Hours as h:mm (e.g. 5400 s -> "1:30"), the usual timesheet format. */
export function formatHoursMinutes(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
