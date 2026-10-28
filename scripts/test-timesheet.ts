// Offline checks for the timesheet: date-range presets in the business time zone, the 366-day
// cap, grouping totals, hour formatting and query parsing. No database, no network.
//
//   npx tsx scripts/test-timesheet.ts

import {
  dayKeyInZone,
  decimalHours,
  formatHms,
  formatHoursMinutes,
  groupEntries,
  monthRange,
  resolveRange,
  secondsInRange,
  splitByDay,
  type TimesheetEntry,
} from "../lib/timesheet";
import { csvCell, toCsv } from "../lib/csv";
import { parseTimesheetQuery } from "../lib/validations/timesheet";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

const TZ = "Asia/Kolkata";
const monday = new Date("2026-10-05T02:00:00Z"); // Monday 07:30 IST

// 1. Presets ----------------------------------------------------------------------------
const week = resolveRange("this_week", {}, monday, TZ);
assert(week.fromKey === "2026-10-05" && week.toKey === "2026-10-11" && week.days === 7, `this week, got ${week.fromKey}..${week.toKey}`);
assert(week.from.toISOString() === "2026-10-04T18:30:00.000Z", `week starts at IST midnight, got ${week.from.toISOString()}`);
assert(week.to.toISOString() === "2026-10-11T18:30:00.000Z", "week end is exclusive (start of the next Monday)");

const sunday = resolveRange("this_week", {}, new Date("2026-10-11T10:00:00Z"), TZ);
assert(sunday.fromKey === "2026-10-05" && sunday.toKey === "2026-10-11", "Sunday still belongs to the week that began Monday");

const last = resolveRange("last_week", {}, monday, TZ);
assert(last.fromKey === "2026-09-28" && last.toKey === "2026-10-04", "last week");

assert(resolveRange("this_month", {}, monday, TZ).toKey === "2026-10-31", "this month ends on the 31st");
const lastMonth = resolveRange("last_month", {}, monday, TZ);
assert(lastMonth.fromKey === "2026-09-01" && lastMonth.toKey === "2026-09-30" && lastMonth.days === 30, "last month");
assert(resolveRange("last_month", {}, new Date("2026-01-10T05:00:00Z"), TZ).fromKey === "2025-12-01", "last month across the new year");
const year = resolveRange("this_year", {}, monday, TZ);
assert(year.fromKey === "2026-01-01" && year.toKey === "2026-12-31" && year.days === 365, "this year");
assert(resolveRange("today", {}, new Date("2026-10-05T20:00:00Z"), TZ).fromKey === "2026-10-06", "after IST midnight it is already the next day");

// 2. Custom ranges ------------------------------------------------------------------------
const custom = resolveRange("custom", { from: "2026-03-01", to: "2026-03-15" }, monday, TZ);
assert(custom.days === 15 && custom.to.toISOString() === "2026-03-15T18:30:00.000Z", "custom range is inclusive of the last day");
const reversed = resolveRange("custom", { from: "2026-03-15", to: "2026-03-01" }, monday, TZ);
assert(reversed.fromKey === "2026-03-01" && reversed.toKey === "2026-03-15", "reversed dates are swapped");
const capped = resolveRange("custom", { from: "2025-01-01", to: "2026-12-31" }, monday, TZ);
assert(capped.days === 366 && capped.toKey === "2026-01-01", `range capped at 366 days, got ${capped.days} ending ${capped.toKey}`);
assert(resolveRange("custom", { from: "nope" }, monday, TZ).fromKey === "2026-10-05", "bad custom dates fall back to today");

// DST: a 23-hour day in New York still starts and ends on local midnight.
const ny = resolveRange("custom", { from: "2026-03-08", to: "2026-03-08" }, new Date("2026-03-08T12:00:00Z"), "America/New_York");
assert(ny.to.getTime() - ny.from.getTime() === 23 * 3600_000, "spring-forward day is 23 hours long");

// 3. Grouping -----------------------------------------------------------------------------
const entry = (over: Partial<TimesheetEntry>): TimesheetEntry => ({
  id: Math.random().toString(36).slice(2),
  userId: "u1",
  userName: "Tarang",
  projectId: "p1",
  projectName: "Saloonly",
  taskId: "t1",
  taskTitle: "OAuth client",
  description: null,
  startedAt: new Date("2026-10-05T04:00:00Z"),
  endedAt: new Date("2026-10-05T05:00:00Z"),
  running: false,
  seconds: 3600,
  ...over,
});
const entries = [
  entry({ seconds: 3600 }),
  entry({ seconds: 1800, startedAt: new Date("2026-10-06T04:00:00Z") }),
  entry({ taskId: "t2", taskTitle: "Footer", userId: "u2", userName: "Naitik", seconds: 7200 }),
  entry({ taskId: null, taskTitle: null, projectId: "p2", projectName: "Vault", seconds: 600 }),
];
const byTask = groupEntries(entries, "task", TZ);
assert(byTask[0].label === "Footer" && byTask[0].seconds === 7200, "groups sorted by time, largest first");
assert(byTask.find((g) => g.label === "OAuth client")?.seconds === 5400, "entries of one task are summed");
assert(byTask.some((g) => g.label === "Vault (no task)"), "entries without a task are grouped under their project");
assert(Math.abs(byTask.reduce((s, g) => s + g.share, 0) - 1) < 1e-9, "shares add up to 100%");
const byPerson = groupEntries(entries, "person", TZ);
assert(byPerson.find((g) => g.label === "Tarang")?.seconds === 6000 && byPerson.length === 2, "grouped by person");
assert(groupEntries(entries, "project", TZ).find((g) => g.label === "Saloonly")?.entries === 3, "grouped by project");
const byDay = groupEntries(entries, "day", TZ);
assert(byDay.map((g) => g.key).join() === "2026-10-05,2026-10-06", "days are in chronological order");
assert(dayKeyInZone(new Date("2026-10-05T20:00:00Z"), TZ) === "2026-10-06", "a late-evening UTC entry belongs to the next IST day");

// 4. Formatting ---------------------------------------------------------------------------
assert(formatHoursMinutes(5400) === "1:30" && formatHoursMinutes(0) === "0:00", "h:mm");
assert(formatHoursMinutes(29) === "0:00" && formatHoursMinutes(30) === "0:01", "rounds to the nearest minute");
assert(formatHoursMinutes(36000 + 59 * 60) === "10:59", "hours above nine are not padded");

// 5. Query parsing -------------------------------------------------------------------------
const bad = parseTimesheetQuery({ preset: "bogus", from: "31/12/2026", user: "a b", group: "nope", project: ["p1", "p2"] });
assert(bad.preset === "this_week" && bad.from === undefined && bad.user === undefined && bad.group === "task", "invalid query values fall back to defaults");
assert(bad.project === "p1", "array params use the first value");
const good = parseTimesheetQuery({ preset: "custom", from: "2026-03-01", to: "2026-03-31", group: "person", user: "ck123" });
assert(good.preset === "custom" && good.group === "person" && good.user === "ck123", "valid query is kept");

// 6. Midnight and month boundaries ------------------------------------------------------------
const ist = (local: string) => new Date(`${local}+05:30`);
const night = { startedAt: ist("2026-10-05T23:00:00"), endedAt: ist("2026-10-06T01:00:00"), seconds: 7200 };
const nightDays = splitByDay(night, monday, TZ);
assert(nightDays.length === 2 && nightDays[0].key === "2026-10-05" && nightDays[0].seconds === 3600 && nightDays[1].seconds === 3600, "23:00-01:00 gives an hour to each day");
const oct5 = resolveRange("custom", { from: "2026-10-05", to: "2026-10-05" }, monday, TZ);
assert(secondsInRange(night, oct5.from, oct5.to, monday) === 3600, "clipped to the day");
const odd = { startedAt: ist("2026-10-05T23:59:59"), endedAt: ist("2026-10-07T00:00:02"), seconds: 86403 };
const oddDays = splitByDay(odd, monday, TZ);
assert(oddDays.length === 3 && oddDays.reduce((a, d) => a + d.seconds, 0) === 86403, "parts always add up to the segment");

const monthEnd = { startedAt: ist("2026-10-31T22:00:00"), endedAt: ist("2026-11-01T02:00:00"), seconds: 14400 };
const oct = monthRange("2026-10", monday, TZ);
const nov = monthRange("2026-11", monday, TZ);
assert(oct.fromKey === "2026-10-01" && oct.toKey === "2026-10-31" && oct.days === 31, "month range");
assert(secondsInRange(monthEnd, oct.from, oct.to, monday) === 7200, "October keeps its 2 hours");
assert(secondsInRange(monthEnd, nov.from, nov.to, monday) === 7200, "November gets the other 2 hours");
assert(secondsInRange({ ...night, startedAt: ist("2026-09-01T10:00:00"), endedAt: ist("2026-09-01T11:00:00") }, oct.from, oct.to, monday) === 0, "outside the month counts nothing");
const running = { startedAt: ist("2026-10-31T23:00:00"), endedAt: null, seconds: 7200 };
assert(secondsInRange(running, oct.from, oct.to, ist("2026-11-01T01:00:00")) === 3600, "a running timer counts up to now, clipped");
// An entry edited to a shorter worked time keeps its recorded seconds when fully inside.
assert(secondsInRange({ startedAt: ist("2026-10-10T10:00:00"), endedAt: ist("2026-10-10T12:00:00"), seconds: 3000 }, oct.from, oct.to, monday) === 3000, "recorded seconds win inside the range");

// Paused time: two segments of one session (10:00-10:30, pause, 11:00-11:20) count 50 minutes.
const pausedSession = [
  entry({ startedAt: ist("2026-10-05T10:00:00"), endedAt: ist("2026-10-05T10:30:00"), seconds: 1800 }),
  entry({ startedAt: ist("2026-10-05T11:00:00"), endedAt: ist("2026-10-05T11:20:00"), seconds: 1200 }),
];
assert(groupEntries(pausedSession, "task", TZ)[0].seconds === 3000, "the paused half hour isn't counted");

// Day grouping uses the split parts.
const splitEntry = entry({ ...night, days: nightDays });
const splitGroups = groupEntries([splitEntry], "day", TZ);
assert(splitGroups.length === 2 && splitGroups.every((g) => g.seconds === 3600), "day grouping splits at midnight");

// 7. Export formatting -------------------------------------------------------------------------
assert(formatHms(90061) === "25:01:01" && decimalHours(5400) === 1.5 && decimalHours(1) === 0.0003, "HH:MM:SS and decimal hours");
assert(csvCell("=HYPERLINK(\"x\")") === `"'=HYPERLINK(""x"")"`, "formula injection is defused and quotes doubled");
assert(csvCell("+91 98765") === `"'+91 98765"` && csvCell("-5") === `"'-5"` && csvCell("@cmd") === `"'@cmd"`, "+ - @ prefixed");
assert(csvCell(1.5) === "1.5" && csvCell(null) === "", "numbers stay numeric, null is empty");
const BOM = String.fromCharCode(0xfeff);
const NL = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);
assert(csvCell(`line1${NL}line2, ok`) === `"line1${NL}line2, ok"`, "newlines and commas stay inside quotes");
const csv = toCsv(["Project", "Hours"], [["दिवाली ब्रोशर ✨", 2]]);
assert(csv.startsWith(BOM) && csv.includes(`"दिवाली ब्रोशर ✨",2${CRLF}`), "UTF-8 BOM, Unicode and CRLF");
const month = parseTimesheetQuery({ month: "2026-02", status: "attention" });
assert(month.month === "2026-02" && month.status === "attention", "month and status parsed");
assert(parseTimesheetQuery({ month: "2026-13", status: "x" }).month === undefined, "bad month ignored");

console.log("Timesheet checks passed (presets, custom range, 366-day cap, DST, grouping, formatting, query parsing, midnight/month splits, CSV).");
