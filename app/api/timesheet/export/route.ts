import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import { EXPORT_MAX_ENTRIES, getTimesheet } from "@/lib/services/timesheets";
import { TIMESHEET_TZ, dayKeyInZone, decimalHours, formatHms, groupEntries } from "@/lib/timesheet";
import { parseTimesheetQuery } from "@/lib/validations/timesheet";
import { toCsv, type CsvValue } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** ISO 8601 in the business time zone with its offset, e.g. 2026-10-28T09:15:00+05:30. */
function zoned(date: Date | null): string {
  if (!date) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMESHEET_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : String(parts.timeZoneName).replace("GMT", "");
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

function download(csv: string, name: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Same filters and the same access rules as the /timesheet page (employees: own time only).
//   ?month=YYYY-MM         the calendar month in the business time zone (else the page's range)
//   ?summary=1             totals per project and per task instead of one row per entry
// Entries overlapping the range are included with their original timestamps; "Worked Seconds
// In Range" is the part inside it, so the column sums to the range total.
export async function GET(request: Request) {
  try {
    const user = await requirePermission("timesheet:view");
    const params = new URL(request.url).searchParams;
    const query = parseTimesheetQuery(Object.fromEntries(params.entries()));
    const sheet = await getTimesheet(user, query, new Date(), { limit: EXPORT_MAX_ENTRIES });
    const label = query.month ?? `${sheet.range.fromKey}-to-${sheet.range.toKey}`;
    const tzLabel = TIMESHEET_TZ.replace(/[^A-Za-z0-9]+/g, "-");

    if (params.get("summary") === "1") {
      const rows: CsvValue[][] = [];
      for (const by of ["project", "task"] as const) {
        for (const g of groupEntries(sheet.entries, by)) {
          rows.push([by === "project" ? "Project" : "Task", g.label, g.entries, g.seconds, decimalHours(g.seconds), formatHms(g.seconds)]);
        }
      }
      rows.push(["Total", "", sheet.entries.length, sheet.totalSeconds, decimalHours(sheet.totalSeconds), formatHms(sheet.totalSeconds)]);
      return download(
        toCsv(["Level", "Name", "Entries", "Worked Seconds", "Worked Hours (decimal)", "Worked (HH:MM:SS)"], rows),
        `timesheet-summary-${label}-${tzLabel}.csv`
      );
    }

    const header = [
      "User ID",
      "User",
      "Date",
      "Project",
      "Project Code",
      "Task",
      "Task ID",
      "Session ID",
      "Entry ID",
      "Start",
      "End",
      "Span Seconds",
      "Worked Seconds",
      "Worked Seconds In Range",
      "Worked Hours In Range (decimal)",
      "Worked In Range (HH:MM:SS)",
      "Status",
      "Stop Reason",
      "Interrupted",
      "Corrected",
      "Flagged Over 12h",
      "Source",
      "Notes",
      "Created",
      "Updated",
    ];
    const now = new Date();
    // Oldest first reads naturally in a spreadsheet.
    const rows = [...sheet.entries].reverse().map((e): CsvValue[] => [
      e.userId ?? "",
      e.userName,
      dayKeyInZone(e.startedAt),
      e.projectName,
      e.projectCode ?? "",
      e.taskTitle ?? e.description ?? "",
      e.taskId ?? "",
      e.sessionId,
      e.id,
      zoned(e.startedAt),
      zoned(e.endedAt),
      Math.max(0, Math.floor(((e.endedAt ?? now).getTime() - e.startedAt.getTime()) / 1000)),
      e.recordedSeconds,
      e.seconds,
      decimalHours(e.seconds),
      formatHms(e.seconds),
      e.status,
      e.stopReason ?? "",
      e.interrupted ? "yes" : "no",
      e.corrected ? "yes" : "no",
      e.flagged ? "yes" : "no",
      e.source ?? "",
      e.notes ?? "",
      zoned(e.createdAt),
      zoned(e.updatedAt),
    ]);
    if (sheet.truncated) rows.push([`Only the first ${EXPORT_MAX_ENTRIES} entries are included. Narrow the filters.`]);
    return download(toCsv(header, rows), `timesheet-${label}-${tzLabel}.csv`);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
