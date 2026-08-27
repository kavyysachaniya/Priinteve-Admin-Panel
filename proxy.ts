import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/public",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths always
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for NextAuth session cookies directly to avoid Edge Runtime DB import issues
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token");

  // If authenticated, allow through
  if (hasSession) {
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
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

