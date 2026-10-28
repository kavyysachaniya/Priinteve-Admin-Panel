import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/lib/auth/api";
import { authenticateDevice } from "@/lib/services/companion/devices";
import { getCompanionTimerState } from "@/lib/services/companion/timer";

export const dynamic = "force-dynamic";

// GET from the desktop app: the person's open work session (running or paused), the projects and
// tasks they can track against, and the server time. Also records the app's heartbeat while a
// timer runs. Authenticated with the device token (excluded from the session check in proxy.ts
// by exact path).
export async function GET(request: Request) {
  try {
    const user = await authenticateDevice(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or revoked device token." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(await getCompanionTimerState(user), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
