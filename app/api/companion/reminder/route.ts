import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/lib/auth/api";
import { authenticateDevice } from "@/lib/services/companion/devices";
import { buildReminder } from "@/lib/services/companion/reminder";

export const dynamic = "force-dynamic";

// Polled by the desktop app every 30 minutes during the person's work hours. Excluded from
// the session check in proxy.ts by exact path; the device token is the only authentication.
export async function GET(request: Request) {
  try {
    const user = await authenticateDevice(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or revoked device token." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
      );
    }
    const payload = await buildReminder(user, { origin: new URL(request.url).origin });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
