import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { logActivity } from "@/lib/services/activity";

// Connected Gmail accounts. Every query is scoped to the owning user,
// and encrypted token columns are never selected for the UI.

const ACCOUNT_SELECT = {
  id: true,
  label: true,
  enabled: true,
  status: true,
  lastError: true,
  updatedAt: true,
} as const;

export async function listGmailAccounts(userId: string) {
  return prisma.companionGmailAccount.findMany({
    where: { userId },
    select: { ...ACCOUNT_SELECT, email: true, excludeFromProcessing: true },
    orderBy: { createdAt: "asc" },
  });
}

export type GmailAccountRow = Awaited<ReturnType<typeof listGmailAccounts>>[number];

async function ownedGmail(userId: string, id: string) {
  const account = await prisma.companionGmailAccount.findFirst({ where: { id, userId }, select: { id: true, email: true } });
  if (!account) throw new Error("That Gmail account could not be found.");
  return account;
}

export async function updateGmailAccount(
  userId: string,
  id: string,
  data: { enabled?: boolean; excludeFromProcessing?: boolean; label?: string },
) {
  await ownedGmail(userId, id);
  await prisma.companionGmailAccount.update({ where: { id }, data });
}

export async function deleteGmailAccount(userId: string, id: string) {
  const account = await ownedGmail(userId, id);
  await prisma.companionGmailAccount.delete({ where: { id } });
  await logActivity({
    type: "companion.gmail_removed",
    message: `Gmail account ${account.email} removed from the companion`,
    entityType: "companion",
    entityId: id,
    userId,
  });
}

/** Called by the Google OAuth callback. Reconnecting the same address replaces its token. */
export async function saveGmailConnection(userId: string, input: { email: string; label: string; refreshToken: string }) {
  const encRefreshToken = encryptSecret(input.refreshToken);
  const account = await prisma.companionGmailAccount.upsert({
    where: { userId_email: { userId, email: input.email } },
    create: { userId, email: input.email, label: input.label, encRefreshToken },
    update: { encRefreshToken, status: "CONNECTED", lastError: null },
  });
  await logActivity({
    type: "companion.gmail_connected",
    message: `Gmail account ${input.email} connected to the companion`,
    entityType: "companion",
    entityId: account.id,
    userId,
  });
  return account.id;
}
