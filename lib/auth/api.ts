import { NextResponse } from "next/server";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";

/** Maps a caught error to the appropriate API error response, without leaking internals. */
export function toApiErrorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A record with these details already exists." }, { status: 409 });
    }
    if (err.code === "P2025") {
      return NextResponse.json({ error: "The requested record could not be found." }, { status: 404 });
    }
    console.error("Prisma API error:", err.code, err.message);
    return NextResponse.json({ error: "A database error occurred." }, { status: 500 });
  }
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    console.error("Prisma API internal error:", err);
    return NextResponse.json({ error: "A database error occurred." }, { status: 500 });
  }
  const message = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: message }, { status: 400 });
}
