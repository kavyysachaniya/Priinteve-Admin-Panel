import { NextResponse } from "next/server";
import { randomToken, safeEqual } from "@/lib/crypto";
import { companionAccountLabelSchema } from "@/lib/validations/companion";

// CSRF protection for the Gmail connect flow: a random `state` value is sent
// to the provider and kept in a short-lived httpOnly cookie together with the user id and
// the label the user typed. The callback must present the same state for the same user.

export type OAuthProvider = "google";

interface StatePayload {
  nonce: string;
  userId: string;
  label: string;
}

const MAX_AGE_SECONDS = 10 * 60;
const cookieName = (provider: OAuthProvider) => `companion_oauth_${provider}`;

export function parseLabel(raw: string | null, fallback: string): string {
  const parsed = companionAccountLabelSchema.safeParse(raw ?? "");
  return parsed.success ? parsed.data : fallback;
}

/** Sets the state cookie on `response` and returns the state to send to the provider. */
export function issueOAuthState(response: NextResponse, provider: OAuthProvider, userId: string, label: string): string {
  const nonce = randomToken(24);
  const payload: StatePayload = { nonce, userId, label };
  response.cookies.set(cookieName(provider), Buffer.from(JSON.stringify(payload)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/companion",
    maxAge: MAX_AGE_SECONDS,
  });
  return nonce;
}

/** Validates the callback's state against the cookie. Returns the label on success. */
export function verifyOAuthState(
  request: Request & { cookies: { get(name: string): { value: string } | undefined } },
  provider: OAuthProvider,
  userId: string,
  state: string | null,
): { label: string } | null {
  const raw = request.cookies.get(cookieName(provider))?.value;
  if (!raw || !state) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<StatePayload>;
    if (typeof payload.nonce !== "string" || typeof payload.userId !== "string" || typeof payload.label !== "string") return null;
    if (!safeEqual(payload.nonce, state) || payload.userId !== userId) return null;
    return { label: payload.label };
  } catch {
    return null;
  }
}

export function clearOAuthState(response: NextResponse, provider: OAuthProvider) {
  response.cookies.set(cookieName(provider), "", { path: "/api/companion", maxAge: 0 });
}

/** Redirect back to the Companion page with a notice code (never free text from the provider). */
export function backToCompanion(appUrl: string, notice: string, anchor: "gmail") {
  return NextResponse.redirect(`${appUrl}/companion?notice=${encodeURIComponent(notice)}#${anchor}`);
}
