import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/lib/auth/api";
import { authenticateDevice } from "@/lib/services/companion/devices";
import { applyCompanionTimerOps } from "@/lib/services/companion/timer";
import { companionTimerOpsSchema } from "@/lib/validations/companion-timer";

export const dynamic = "force-dynamic";

// POST from the desktop app: a batch of journaled timer operations, applied in order. Replaying
// an op id returns its first result. Authenticated with the device token (excluded from the
// session check in proxy.ts by exact path).
export async function POST(request: Request) {
  try {
    const user = await authenticateDevice(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or revoked device token." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
      );
    }
    const parsed = companionTimerOpsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await applyCompanionTimerOps(user, parsed.data.ops);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
