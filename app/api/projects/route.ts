import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { projectFormSchema } from "@/lib/validations/project";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import type { ProjectPriority, ProjectStatus } from "@prisma/client";
import type { ListProjectsParams } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

type ProjectSortField = NonNullable<ListProjectsParams["sort"]>;

const SORT_FIELDS: ProjectSortField[] = ["createdAt", "name", "dueDate", "priority", "totalTime"];

export async function GET(request: Request) {
  try {
    await requirePermission("projects:view");

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const status = (searchParams.get("status") as ProjectStatus) || undefined;
    const priority = (searchParams.get("priority") as ProjectPriority) || undefined;
    const assignedToId = searchParams.get("assignedToId") ?? undefined;
    const customerId = searchParams.get("customerId") ?? undefined;
    const hasActiveTimer = searchParams.get("hasActiveTimer") === "true";
    const sortParam = searchParams.get("sort");
    const sort = SORT_FIELDS.find((f) => f === sortParam);
    const order = (searchParams.get("order") as "asc" | "desc") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "15", 10);

    const result = await projectService.listProjects({
      q,
      status,
      priority,
      assignedToId,
      customerId,
      hasActiveTimer,
      sort,
      order,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("projects:create");

    const body = await request.json();
    const parsed = projectFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", details: parsed.error.format() }, { status: 400 });
    }

    const project = await projectService.createProject(parsed.data, user.id);
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
