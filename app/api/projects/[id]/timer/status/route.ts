import { NextResponse } from "next/server";
import { auth } from "@/auth";
import * as projectService from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const status = await projectService.getProjectTimerStatus(id);
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to get timer status" }, { status: 400 });
  }
}
