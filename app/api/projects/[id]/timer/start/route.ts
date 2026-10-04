import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

import { startTimerSchema } from "@/lib/validations/project";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("projects:timer");
    const { id } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const taskDescription = body?.taskDescription || body?.notes || "Working on project";
    const taskId = body?.taskId || null;

    const parsed = startTimerSchema.safeParse({ taskDescription, taskId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const entry = await projectService.startProjectTimer(
      id,
      user.id,
      parsed.data.taskDescription,
      parsed.data.taskId,
      { autoStopPrevious: true }
    );

    return NextResponse.json(
      {
        success: true,
        entry,
        autoStoppedProjectName: entry.autoStoppedProjectName,
      },
      { status: 200 }
    );
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("already has an active timer") ||
        err.message.includes("already have an active timer"))
    ) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toApiErrorResponse(err);
  }
}
