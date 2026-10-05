import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { exchangeGoogleCode, getGmailProfileEmail } from "@/lib/services/companion/google";
import { saveGmailConnection } from "@/lib/services/companion/accounts";
import { invalidateBriefingCache } from "@/lib/services/companion/briefing";
import { companionAppUrl } from "@/lib/services/companion/settings";
import { backToCompanion, clearOAuthState, verifyOAuthState } from "@/lib/services/companion/oauth-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const appUrl = companionAppUrl(request.nextUrl.origin);
  let notice = "gmail_connected";
  try {
    const user = await requirePermission("companion:use");
    const params = request.nextUrl.searchParams;
    const verified = verifyOAuthState(request, "google", user.id, params.get("state"));
    const code = params.get("code");
    if (params.get("error")) {
      notice = "gmail_cancelled";
    } else if (!verified || !code) {
      notice = "oauth_state_mismatch";
    } else {
      const { accessToken, refreshToken } = await exchangeGoogleCode(appUrl, code);
      const email = await getGmailProfileEmail(accessToken);
      await saveGmailConnection(user.id, { email, label: verified.label, refreshToken });
      invalidateBriefingCache(user.id);
    }
  } catch (err) {
    console.warn(`[companion] Gmail connect failed: ${err instanceof Error ? err.message : "unknown"}`);
    notice = "gmail_failed";
  }
  const response = backToCompanion(appUrl, notice, "gmail");
  clearOAuthState(response, "google");
  return response;
}
