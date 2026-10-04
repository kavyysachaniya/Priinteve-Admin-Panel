import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("projects:timer");

    let taskDescription: string | undefined;
    try {
      const body = await request.json();
      taskDescription = body?.taskDescription;
    } catch {
      // Body is optional
    }

    const entry = await projectService.stopActiveTimerForUser(user.id, taskDescription);
    return NextResponse.json({ success: true, entry }, { status: 200 });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
