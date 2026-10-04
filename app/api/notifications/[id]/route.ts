import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import * as notificationService from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    await notificationService.markNotificationRead(id, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
