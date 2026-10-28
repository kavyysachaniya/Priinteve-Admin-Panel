import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

// The correction history of one time entry (edits, recovery). Admins: any entry; employees: their own.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("timesheet:view");
    const { id } = await params;
    const corrections = await projectService.listTimeEntryCorrections(id, user);
    return NextResponse.json({ corrections });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
