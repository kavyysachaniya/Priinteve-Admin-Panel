import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("projects:view");

    const { id } = await params;
    const status = await projectService.getProjectTimerStatus(id);
    return NextResponse.json(status);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
