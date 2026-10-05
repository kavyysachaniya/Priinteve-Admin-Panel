// Calendar-day boundaries in the user's companion time zone. The server runs in UTC on
// Vercel, so "today" must be computed explicitly rather than with local Date methods.

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Milliseconds to add to UTC to get wall-clock time in the zone, at the given instant. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export interface ZonedDay {
  /** YYYY-MM-DD in the zone. */
  key: string;
  start: Date;
  /** Exclusive end (start of the next day). */
  end: Date;
}

/** The calendar day `offsetDays` from today (0 = today, -1 = yesterday, 1 = tomorrow) in the zone. */
export function zonedDay(timeZone: string, offsetDays = 0, now = new Date()): ZonedDay {
  const today = partsInZone(now, timeZone);
  const startOf = (dayOffset: number) => {
    const wall = Date.UTC(today.year, today.month - 1, today.day + dayOffset);
    // Two passes handle a DST change between the guess and the real instant.
    let instant = wall - zoneOffsetMs(new Date(wall), timeZone);
    instant = wall - zoneOffsetMs(new Date(instant), timeZone);
    return new Date(instant);
  };
  const start = startOf(offsetDays);
  const end = startOf(offsetDays + 1);
  const keyDate = new Date(Date.UTC(today.year, today.month - 1, today.day + offsetDays));
  return { key: keyDate.toISOString().slice(0, 10), start, end };
}

export function hourInZone(timeZone: string, now = new Date()): number {
  return partsInZone(now, timeZone).hour;
}
