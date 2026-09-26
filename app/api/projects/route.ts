import { NextResponse } from "next/server";
import { auth } from "@/auth";
import * as projectService from "@/lib/services/projects";
import { projectFormSchema } from "@/lib/validations/project";
import { roleHasPermission } from "@/lib/auth/permissions";
import type { ProjectPriority, ProjectStatus, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const status = (searchParams.get("status") as ProjectStatus) || undefined;
    const priority = (searchParams.get("priority") as ProjectPriority) || undefined;
    const assignedToId = searchParams.get("assignedToId") ?? undefined;
    const customerId = searchParams.get("customerId") ?? undefined;
    const hasActiveTimer = searchParams.get("hasActiveTimer") === "true";
    const sort = (searchParams.get("sort") as any) ?? undefined;
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as UserRole;
    if (!roleHasPermission(role, "projects:create")) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = projectFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", details: parsed.error.format() }, { status: 400 });
    }

    const project = await projectService.createProject(parsed.data, session.user.id);
    return NextResponse.json(project, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create project" }, { status: 500 });
  }
}
