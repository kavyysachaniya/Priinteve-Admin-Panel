import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/lib/auth/api";
import { authenticateDevice } from "@/lib/services/companion/devices";
import { buildBriefing } from "@/lib/services/companion/briefing";

export const dynamic = "force-dynamic";
// Website, Slack and Gmail checks run in parallel; give them room on Vercel.
export const maxDuration = 60;

// Called by the desktop companion with `Authorization: Bearer pcd_…`. This path is excluded
// from the session check in proxy.ts, so the device token is the only authentication.
export async function GET(request: Request) {
  try {
    const user = await authenticateDevice(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or revoked device token." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
      );
    }
    const { origin, searchParams } = new URL(request.url);
    const briefing = await buildBriefing(user, { origin, fresh: searchParams.get("fresh") === "1" });
    return NextResponse.json(briefing, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
