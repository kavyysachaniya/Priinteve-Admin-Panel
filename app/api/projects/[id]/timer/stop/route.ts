import { NextResponse } from "next/server";
import { auth } from "@/auth";
import * as projectService from "@/lib/services/projects";
import { roleHasPermission } from "@/lib/auth/permissions";
import type { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as UserRole;
    if (!roleHasPermission(role, "projects:timer")) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    await projectService.stopProjectTimer(id, session.user.id);
    return NextResponse.json({ success: true, message: "Timer stopped" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to stop timer" }, { status: 400 });
  }
}
