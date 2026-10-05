import { NextResponse } from "next/server";
import { z } from "zod";
import { toApiErrorResponse } from "@/lib/auth/api";
import { authenticateDevice } from "@/lib/services/companion/devices";
import { runCompanionTaskAction } from "@/lib/services/companion/task-actions";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["complete", "start-timer", "stop-timer"]),
  // Not needed to stop the running timer, but always validated when sent.
  taskId: z.string().trim().max(40).default(""),
});

// POST from the desktop app: mark a task done or start/stop its timer. Authenticated with the
// device token (excluded from the session check in proxy.ts by exact path).
export async function POST(request: Request) {
  try {
    const user = await authenticateDevice(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or revoked device token." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
      );
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || (parsed.data.action !== "stop-timer" && !parsed.data.taskId)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const result = await runCompanionTaskAction(user, parsed.data.action, parsed.data.taskId);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
