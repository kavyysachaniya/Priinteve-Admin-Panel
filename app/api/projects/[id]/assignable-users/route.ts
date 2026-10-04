import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import * as taskService from "@/lib/services/tasks";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("tasks:view");
    const { id } = await params;

    const project = await projectService.getProjectById(id, user);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ users: await taskService.listAssignableUsers(id) });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
