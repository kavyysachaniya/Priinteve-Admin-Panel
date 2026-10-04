import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("projects:approve_time");
    const { id } = await params;
    const count = await projectService.approveAllCompletedEntries(id, user);
    return NextResponse.json({ success: true, approved: count });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
