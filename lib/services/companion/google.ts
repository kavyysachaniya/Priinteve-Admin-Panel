// Google OAuth for the companion's Gmail integration. The only Gmail scope requested is
// gmail.readonly (read mail; no sending, no drafts, no modifying). The account's address
// comes from the Gmail profile endpoint, so no extra profile scope is needed.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 10_000;

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google sign-in isn't configured on the server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  return { clientId, clientSecret };
}

export function googleRedirectUri(appUrl: string) {
  return `${appUrl}/api/companion/google/callback`;
}

export function buildGoogleAuthUrl(appUrl: string, state: string, loginHint?: string) {
  const { clientId } = credentials();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri(appUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", state);
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return url.toString();
}

/** Raised when Google says the refresh token is no longer valid (revoked, expired, password change). */
export class GoogleReconnectError extends Error {}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };
  if (json.error === "invalid_grant") throw new GoogleReconnectError("Google access was revoked or expired");
  if (!res.ok || !json.access_token) throw new Error(`Google token request failed (${json.error ?? res.status})`);
  return json;
}

export async function exchangeGoogleCode(appUrl: string, code: string) {
  const { clientId, clientSecret } = credentials();
  const json = await tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleRedirectUri(appUrl),
    grant_type: "authorization_code",
  });
  if (!json.refresh_token) throw new Error("Google didn't return offline access. Remove the app's access in your Google account and connect again.");
  const granted = (json.scope ?? "").split(" ");
  if (!granted.includes(GMAIL_SCOPE)) throw new Error("Gmail read access wasn't granted. Tick the Gmail permission when connecting.");
  return { accessToken: json.access_token!, refreshToken: json.refresh_token };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = credentials();
  const json = await tokenRequest({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  return json.access_token!;
}

export async function gmailGet<T>(accessToken: string, path: string, params?: Record<string, string | string[]>): Promise<T> {
  const url = new URL(`${GMAIL_API}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    for (const v of Array.isArray(value) ? value : [value]) url.searchParams.append(key, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 401) throw new GoogleReconnectError("Gmail rejected the access token");
  if (!res.ok) throw new Error(`Gmail API returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function getGmailProfileEmail(accessToken: string): Promise<string> {
  const profile = await gmailGet<{ emailAddress?: string }>(accessToken, "/profile");
  if (!profile.emailAddress) throw new Error("Couldn't read the Gmail address");
  return profile.emailAddress.toLowerCase();
}
