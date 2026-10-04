import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import * as taskService from "@/lib/services/tasks";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import { taskFormSchema } from "@/lib/validations/task";

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

    const result = await taskService.listTasks({ projectId: id }, user);
    return NextResponse.json(result);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("tasks:create");
    const { id } = await params;

    const project = await projectService.getProjectById(id, user);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const dataWithProject = {
      ...body,
      projectId: id,
      customerId: project.customerId ?? body.customerId,
    };

    const parsed = taskFormSchema.safeParse(dataWithProject);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const created = await taskService.createTask(parsed.data, user);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
