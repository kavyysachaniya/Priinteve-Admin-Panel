import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import { assignEmployeesSchema } from "@/lib/validations/project";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("projects:view");
    const { id } = await params;

    const project = await projectService.getProjectById(id, user);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const assignments = await projectService.getProjectAssignments(id);
    return NextResponse.json(assignments);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("projects:edit");
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can assign employees to projects." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = assignEmployeesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const assignments = await projectService.assignEmployeesToProject(
      id,
      parsed.data.employeeIds,
      user
    );

    return NextResponse.json({ success: true, assignments }, { status: 200 });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
