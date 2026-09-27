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
    const user = await requirePermission("projects:timer");

    const { id } = await params;
    const entry = await projectService.resumeProjectTimer(id, user.id);
    return NextResponse.json({ success: true, entry }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && (err.message.includes("already has an active timer") || err.message.includes("already have an active timer"))) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toApiErrorResponse(err);
  }
}
