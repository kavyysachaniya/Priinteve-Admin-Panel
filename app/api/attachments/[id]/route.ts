import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import { getTaskAttachmentDownloadUrl } from "@/lib/services/attachments";

export const dynamic = "force-dynamic";

// Opens or downloads a task attachment: checks the user can see the task, then redirects
// to a 5-minute presigned S3 link.
export async function GET(_request: Request, { params }: RouteContext<"/api/attachments/[id]">) {
  try {
    const user = await requirePermission("tasks:view");
    const { id } = await params;
    const url = await getTaskAttachmentDownloadUrl(user, id);
    return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
