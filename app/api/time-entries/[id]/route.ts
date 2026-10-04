import { NextResponse } from "next/server";
import * as projectService from "@/lib/services/projects";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import { timeEntryUpdateSchema } from "@/lib/validations/project";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("projects:timer");
    const { id } = await params;

    const body = await request.json();
    const parsed = timeEntryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await projectService.updateTimeEntry(id, parsed.data, user);
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
    const user = await requirePermission("projects:timer");
    const { id } = await params;

    await projectService.deleteTimeEntry(id, user);
    return NextResponse.json({ success: true, message: "Time entry deleted successfully." });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
