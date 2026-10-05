import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logActivity } from "@/lib/services/activity";

// A user's own account. Every function takes the signed-in user's id from the session,
// never from the request, so nobody can edit someone else's account here.

export async function getOwnAccount(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true },
  });
}

export async function updateOwnName(userId: string, name: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { name }, select: { name: true } });
  await logActivity({
    type: "account.name_changed",
    message: `${user.name} updated their display name`,
    entityType: "user",
    entityId: userId,
    userId,
  });
  return user.name;
}

/** Verifies the current password, then stores the new one. Throws user-readable errors. */
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, name: true } });
  // Accounts without a stored password (e.g. created without one) can't prove the old password.
  if (!user?.passwordHash) throw new Error("This account has no password set. Ask an admin to set one.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new Error("Your current password is incorrect.");
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await logActivity({
    type: "account.password_changed",
    message: `${user.name} changed their password`,
    entityType: "user",
    entityId: userId,
    userId,
  });
}
