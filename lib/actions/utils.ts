import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

export type FormActionResult =
  | { success: true; id?: string; message?: string }
  | { success: false; message: string; fieldErrors?: Record<string, string> };

export function flattenZodError(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  for (const [key, val] of Object.entries(fieldErrors)) {
    if (val?.[0]) out[key] = val[0];
  }
  return out;
}

export function friendlyError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return "A record with these details already exists.";
    }
    if (err.code === "P2025") {
      return "The requested record could not be found.";
    }
    if (err.code === "P2003") {
      return "Cannot delete or modify this record because other records depend on it.";
    }
    console.error("Prisma error:", err.code, err.message);
    return "A database error occurred. Please try again.";
  }
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    console.error("Prisma internal error:", err);
    return "A database error occurred. Please try again.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
