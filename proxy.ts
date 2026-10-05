import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/public",
];

// Exact paths that authenticate themselves (bearer device token checked inside the route).
const SELF_AUTHENTICATED_PATHS = ["/api/companion/briefing", "/api/companion/reminder", "/api/companion/update", "/api/companion/task", "/api/companion/live"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || SELF_AUTHENTICATED_PATHS.includes(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths always
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Cryptographically verify the session JWT (signature + expiry) without
  // touching the database, so this stays Edge Runtime-safe while actually
  // authenticating the request instead of trusting cookie presence alone.
  // Over HTTPS Auth.js names the cookie `__Secure-authjs.session-token` (and uses that name
  // as the encryption salt), so check the secure name first and fall back to the plain one.
  const secret = process.env.AUTH_SECRET;
  const token =
    (await getToken({ req: request, secret, secureCookie: true })) ??
    (await getToken({ req: request, secret, secureCookie: false }));

  // If authenticated, allow through (with role-based module restrictions)
  if (token) {
    if (token.role === "CLIENT") {
      const isAllowedForClient =
        pathname.startsWith("/projects") ||
        pathname.startsWith("/tasks") ||
        pathname.startsWith("/timer") ||
        pathname.startsWith("/time-entries") ||
        pathname.startsWith("/api/projects") ||
        pathname.startsWith("/api/tasks") ||
        pathname.startsWith("/api/timer") ||
        pathname.startsWith("/api/time-entries") ||
        pathname.startsWith("/api/notifications") ||
        pathname.startsWith("/api/attachments") ||
        pathname.startsWith("/account") ||
        pathname.startsWith("/api/auth");

      if (!isAllowedForClient) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Forbidden: You do not have permission to access this resource." },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/projects", request.url));
      }
    }

    return NextResponse.next();
  }

  // Not authenticated → redirect to login, preserving intended destination
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)",
  ],
};

