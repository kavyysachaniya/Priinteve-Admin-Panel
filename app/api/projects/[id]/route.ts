import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { projectFormSchema } from "@/lib/validations/project";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

import { toClientProjectDto } from "@/lib/auth/projects";

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

    if (user.role === "CLIENT") {
      return NextResponse.json(toClientProjectDto(project));
    }

    return NextResponse.json(project);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("projects:edit");

    const { id } = await params;
    const body = await request.json();
    const parsed = projectFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", details: parsed.error.format() }, { status: 400 });
    }

    const updated = await projectService.updateProject(id, parsed.data, user.id);
    return NextResponse.json(updated);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("projects:delete");

    const { id } = await params;
    await projectService.deleteProject(id, user.id);
    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
