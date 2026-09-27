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
    const entry = await projectService.pauseProjectTimer(id, user.id);
    return NextResponse.json({ success: true, entry }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("only control your own timer")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return toApiErrorResponse(err);
  }
}
