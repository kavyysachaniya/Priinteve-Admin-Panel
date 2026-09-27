import { NextResponse } from "next/server";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/session";

/** Maps a caught error to the appropriate API error response, without leaking internals. */
export function toApiErrorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  const message = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: message }, { status: 400 });
}
