import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/lib/auth/api";
import { authenticateDevice } from "@/lib/services/companion/devices";
import { getUpdateOffer } from "@/lib/services/companion/installer";
import { parseVersion } from "@/lib/services/companion/versions";

export const dynamic = "force-dynamic";

// The desktop app asks "is there a newer installer than x.y.z?". Authenticated with the
// device token (excluded from the session check in proxy.ts by exact path). The answer
// carries a 10-minute signed download link and the SHA-256 the app must verify.
export async function GET(request: Request) {
  try {
    const user = await authenticateDevice(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or revoked device token." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
      );
    }
    const current = new URL(request.url).searchParams.get("current") ?? "";
    if (!parseVersion(current)) {
      return NextResponse.json({ error: "Send ?current=x.y.z" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(await getUpdateOffer(current), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
