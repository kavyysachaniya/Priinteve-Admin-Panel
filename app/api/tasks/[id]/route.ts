import { NextResponse } from "next/server";
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

    const task = await taskService.getTaskDetail(id, user);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("tasks:edit");
    const { id } = await params;

    const existing = await taskService.getTaskDetail(id, user);
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json();
    const currentValues = taskService.taskToFormValues(existing as any);
    const mergedValues = {
      ...currentValues,
      ...body,
    };

    const parsed = taskFormSchema.partial().safeParse(mergedValues);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await taskService.updateTask(id, parsed.data as any, user);
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
    const user = await requirePermission("tasks:delete");
    const { id } = await params;

    const existing = await taskService.getTaskDetail(id, user);
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await taskService.deleteTask(id, user);
    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
