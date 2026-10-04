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
    const user = await requirePermission("projects:view");

    const { id } = await params;
    const entries = await projectService.listProjectTimeEntries(id, user);
    return NextResponse.json(entries);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
