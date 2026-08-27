import { auth } from "@/auth";
import type { UserRole } from "@prisma/client";
import type { Permission } from "@/lib/auth/permissions";
import { roleHasPermission } from "@/lib/auth/permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

/**
 * Get the current Auth.js session.
 * Returns null if not authenticated.
 */
export async function getSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

/**
 * Require authentication. Throws if not authenticated.
 * Use at the top of every Server Action that mutates data.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    throw new Error("Authentication required. Please log in.");
  }
  return user;
}

/**
 * Require a specific role. Throws if not authenticated or wrong role.
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== role) {
    throw new Error("You don't have permission to perform this action.");
  }
  return user;
}

/**
 * Require a specific permission. Throws if not authenticated or lacking permission.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roleHasPermission(user.role, permission)) {
    throw new Error("You don't have permission to perform this action.");
  }
  return user;
}

/**
 * Check (non-throwing) if current user has a permission.
 * Returns false if not authenticated or lacking permission.
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  const user = await getSession();
  if (!user) return false;
  return roleHasPermission(user.role, permission);
}
