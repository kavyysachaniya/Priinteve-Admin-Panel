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

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
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
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });

  // If authenticated, allow through
  if (token) {
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

