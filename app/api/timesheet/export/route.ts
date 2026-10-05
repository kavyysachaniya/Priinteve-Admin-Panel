import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import { getTimesheet } from "@/lib/services/timesheets";
import { dayKeyInZone, formatHoursMinutes } from "@/lib/timesheet";
import { parseTimesheetQuery } from "@/lib/validations/timesheet";

export const dynamic = "force-dynamic";

/** CSV cell: quoted, with quotes doubled, and a leading ' so spreadsheets don't run formulas. */
function cell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Same filters and the same access rules as the /timesheet page (employees: own time only).
export async function GET(request: Request) {
  try {
    const user = await requirePermission("timesheet:view");
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const sheet = await getTimesheet(user, parseTimesheetQuery(params));

    const lines = [["Date", "Person", "Project", "Task", "Started", "Ended", "Hours (h:mm)", "Seconds"].map(cell).join(",")];
    for (const e of sheet.entries) {
      lines.push(
        [
          dayKeyInZone(e.startedAt),
          e.userName,
          e.projectName,
          e.taskTitle ?? e.description ?? "",
          e.startedAt.toISOString(),
          e.endedAt?.toISOString() ?? "running",
          formatHoursMinutes(e.seconds),
          e.seconds,
        ]
          .map(cell)
          .join(","),
      );
    }
    const name = `timesheet-${sheet.range.fromKey}-to-${sheet.range.toKey}.csv`;
    return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
