import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObjectQuietly,
  headObject,
  isPanelKey,
  safeFileName,
  storageKey,
} from "@/lib/services/storage";
import { INSTALLER_MAX_BYTES } from "@/lib/validations/companion";

// The Windows installer for the desktop companion, kept in S3. An admin uploads it from the
// Companion page; everyone with `companion:use` downloads it through a short-lived link.

const INSTALLER_CONTENT_TYPE = "application/octet-stream";
const INSTALLER_PREFIX = storageKey("companion", "installer");

export async function getInstallerInfo() {
  const row = await prisma.companionTeamPolicy.findUnique({
    where: { id: "default" },
    select: { installerKey: true, installerFileName: true, installerSize: true, installerUploadedAt: true },
  });
  if (!row?.installerKey || !row.installerFileName) return null;
  return { fileName: row.installerFileName, size: row.installerSize, uploadedAt: row.installerUploadedAt };
}

/** Step 1: a presigned PUT for the browser. The file goes straight to S3. */
export async function requestInstallerUpload(fileName: string) {
  const key = `${INSTALLER_PREFIX}/${randomUUID()}/${safeFileName(fileName, "Priinteve-Companion-Setup.exe")}`;
  const uploadUrl = await createUploadUrl(key, INSTALLER_CONTENT_TYPE);
  return { key, uploadUrl, contentType: INSTALLER_CONTENT_TYPE };
}

/** Step 2: verify the uploaded object, make it the current installer, and remove the old one. */
export async function confirmInstallerUpload(userId: string, key: string, fileName: string) {
  if (!isPanelKey(key) || !key.startsWith(`${INSTALLER_PREFIX}/`)) throw new Error("That upload doesn't belong to the installer.");
  const head = await headObject(key);
  if (!head) throw new Error("The upload didn't reach storage. Please try again.");
  if (head.size > INSTALLER_MAX_BYTES) {
    await deleteObjectQuietly(key);
    throw new Error("The installer must be under 500 MB.");
  }

  const previous = await prisma.companionTeamPolicy.findUnique({ where: { id: "default" }, select: { installerKey: true } });
  const data = {
    installerKey: key,
    installerFileName: safeFileName(fileName, "Priinteve-Companion-Setup.exe"),
    installerSize: head.size,
    installerUploadedAt: new Date(),
  };
  await prisma.companionTeamPolicy.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  if (previous?.installerKey && previous.installerKey !== key) await deleteObjectQuietly(previous.installerKey);

  await logActivity({
    type: "companion.installer_uploaded",
    message: `Companion installer ${data.installerFileName} uploaded`,
    entityType: "companion",
    entityId: "installer",
    userId,
  });
}

export async function getInstallerDownloadUrl(): Promise<string | null> {
  const row = await prisma.companionTeamPolicy.findUnique({
    where: { id: "default" },
    select: { installerKey: true, installerFileName: true },
  });
  if (!row?.installerKey || !row.installerFileName) return null;
  return createDownloadUrl(row.installerKey, row.installerFileName, { contentType: "application/vnd.microsoft.portable-executable" });
}
