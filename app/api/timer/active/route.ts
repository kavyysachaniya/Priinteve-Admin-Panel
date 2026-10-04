import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("projects:timer");
    const activeTimer = await projectService.getActiveTimerForUser(user.id);
    return NextResponse.json({ activeTimer });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
