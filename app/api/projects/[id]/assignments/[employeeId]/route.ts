import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  try {
    const user = await requirePermission("projects:edit");
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can unassign employees from projects." },
        { status: 403 }
      );
    }

    const { id, employeeId } = await params;
    await projectService.unassignEmployeeFromProject(id, employeeId, user);

    return NextResponse.json({ success: true, message: "Employee unassigned successfully." });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
