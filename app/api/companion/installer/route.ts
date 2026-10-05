import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import { getInstallerDownloadUrl } from "@/lib/services/companion/installer";

export const dynamic = "force-dynamic";

// "Download for Windows": redirects to a 5-minute presigned S3 link for the current installer.
export async function GET() {
  try {
    await requirePermission("companion:use");
    const url = await getInstallerDownloadUrl();
    if (!url) return NextResponse.json({ error: "No installer has been uploaded yet." }, { status: 404 });
    return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
