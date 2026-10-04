import { prisma } from "@/lib/prisma";

export async function createNotification({
  userId,
  title,
  message,
  type = "INFO",
  link,
}: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
}) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link: link ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
    return null;
  }
}

export async function listUserNotifications(userId: string, limit = 10) {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function getUnreadNotificationCount(userId: string) {
  try {
    return await prisma.notification.count({
      where: { userId, read: false },
    });
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string, userId: string) {
  try {
    return await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  } catch (err) {
    console.error("Failed to mark notification read:", err);
  }
}

export async function markAllNotificationsRead(userId: string) {
  try {
    return await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  } catch (err) {
    console.error("Failed to mark all notifications read:", err);
  }
}
