import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/auth/api";
import { isEncryptionConfigured } from "@/lib/crypto";
import { buildGoogleAuthUrl } from "@/lib/services/companion/google";
import { allowedSections, companionAppUrl, getCompanionTeamPolicy } from "@/lib/services/companion/settings";
import { backToCompanion, issueOAuthState, parseLabel } from "@/lib/services/companion/oauth-state";

export const dynamic = "force-dynamic";

// Starts "Connect Gmail": /api/companion/google/connect?label=Work[&email=me@example.com]
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("companion:use");
    const appUrl = companionAppUrl(request.nextUrl.origin);
    if (!allowedSections(user.role, await getCompanionTeamPolicy()).gmail) {
      return backToCompanion(appUrl, "gmail_not_allowed", "gmail");
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return backToCompanion(appUrl, "google_not_configured", "gmail");
    }
    if (!isEncryptionConfigured()) return backToCompanion(appUrl, "encryption_not_configured", "gmail");

    const label = parseLabel(request.nextUrl.searchParams.get("label"), "Gmail");
    const email = request.nextUrl.searchParams.get("email");
    const response = NextResponse.redirect(appUrl);
    const state = issueOAuthState(response, "google", user.id, label);
    response.headers.set(
      "Location",
      buildGoogleAuthUrl(appUrl, state, email && email.length < 200 ? email : undefined),
    );
    return response;
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
