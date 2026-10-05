import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/lib/auth/api";
import { authenticateDevice } from "@/lib/services/companion/devices";
import { getLiveState, parseLiveIds } from "@/lib/services/companion/live";

export const dynamic = "force-dynamic";

// Polled by the desktop bubble every ~20 s while it is open: the person's running timer and the
// status of the tasks on screen. Authenticated with the device token (excluded from the session
// check in proxy.ts by exact path).
export async function GET(request: Request) {
  try {
    const user = await authenticateDevice(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or revoked device token." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
      );
    }
    const ids = parseLiveIds(new URL(request.url).searchParams.get("tasks"));
    if (ids === null) {
      return NextResponse.json({ error: "Invalid task list." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(await getLiveState(user, ids), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
