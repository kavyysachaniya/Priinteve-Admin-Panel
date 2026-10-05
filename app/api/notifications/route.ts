import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import * as notificationService from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    // Creates (once each) "due soon", "due today" and "overdue" notifications for the user's tasks.
    await notificationService.ensureDueNotifications(user.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    const [notifications, unreadCount] = await Promise.all([
      notificationService.listUserNotifications(user.id, limit),
      notificationService.getUnreadNotificationCount(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));

    if (body.action === "markAllRead") {
      await notificationService.markAllNotificationsRead(user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
