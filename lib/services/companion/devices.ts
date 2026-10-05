import { prisma } from "@/lib/prisma";
import { hashToken, randomToken, safeEqual } from "@/lib/crypto";
import { roleHasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/services/activity";

// Desktop devices authenticate with `pcd_<deviceId>_<secret>`. Only a SHA-256 hash of the
// whole token is stored; the plaintext is shown once when the device is created.

const TOKEN_PREFIX = "pcd";
const MAX_ACTIVE_DEVICES = 10;
const TOKEN_PATTERN = /^pcd_([a-z0-9]{10,40})_([A-Za-z0-9_-]{30,80})$/;
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export async function listDevices(userId: string) {
  return prisma.companionDevice.findMany({
    where: { userId },
    select: { id: true, name: true, lastSeenAt: true, revokedAt: true, createdAt: true },
    orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
  });
}

export type CompanionDeviceRow = Awaited<ReturnType<typeof listDevices>>[number];

/** Creates a device and returns its token. The token can't be retrieved again. */
export async function createDevice(userId: string, name: string) {
  const active = await prisma.companionDevice.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_ACTIVE_DEVICES) {
    throw new Error(`You can have up to ${MAX_ACTIVE_DEVICES} paired computers. Revoke one first.`);
  }
  const device = await prisma.companionDevice.create({ data: { userId, name, tokenHash: "pending" } });
  const token = `${TOKEN_PREFIX}_${device.id}_${randomToken(32)}`;
  await prisma.companionDevice.update({ where: { id: device.id }, data: { tokenHash: hashToken(token) } });
  await logActivity({
    type: "companion.device_created",
    message: `Companion device "${name}" paired`,
    entityType: "companion",
    entityId: device.id,
    userId,
  });
  return { id: device.id, token };
}

export async function revokeDevice(userId: string, deviceId: string) {
  const device = await prisma.companionDevice.findFirst({ where: { id: deviceId, userId } });
  if (!device) throw new Error("That device could not be found.");
  if (device.revokedAt) return;
  await prisma.companionDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
  await logActivity({
    type: "companion.device_revoked",
    message: `Companion device "${device.name}" revoked`,
    entityType: "companion",
    entityId: deviceId,
    userId,
  });
}

/**
 * Resolves a bearer token to its active device and user. Returns null for anything invalid:
 * malformed, unknown, revoked, inactive user, or a role without `companion:use`.
 */
export async function authenticateDevice(authorization: string | null): Promise<SessionUser | null> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const match = token?.match(TOKEN_PATTERN);
  if (!token || !match) return null;

  const device = await prisma.companionDevice.findUnique({
    where: { id: match[1] },
    include: { user: { select: { id: true, name: true, email: true, role: true, status: true, customerId: true } } },
  });
  // Always run the comparison so timing doesn't reveal whether the device id exists.
  const valid = safeEqual(device?.tokenHash ?? "missing", hashToken(token));
  if (!device || !valid || device.revokedAt) return null;
  if (device.user.status !== "ACTIVE" || !roleHasPermission(device.user.role, "companion:use")) return null;

  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await prisma.companionDevice
      .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  const { user } = device;
  return { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId };
}
