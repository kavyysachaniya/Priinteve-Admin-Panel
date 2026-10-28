import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("projects:timer");

    let taskDescription: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.taskDescription === "string") taskDescription = body.taskDescription;
    } catch {
      // Body is optional
    }

    const { id } = await params;
    // Admins may stop another user's running timer; the service enforces this.
    await projectService.stopProjectTimer(id, user.id, taskDescription);
    return NextResponse.json({ success: true, message: "Timer stopped" }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("only control your own timer")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return toApiErrorResponse(err);
  }
}
