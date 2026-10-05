import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/services/activity";
import { getTaskDetail } from "@/lib/services/tasks";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObjectQuietly,
  headObject,
  isPanelKey,
  safeFileName,
  storageKey,
  storageUrl,
} from "@/lib/services/storage";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES, resolveAttachmentType } from "@/lib/validations/attachments";

// Task attachments stored in S3. Access follows the task: whoever can see a task can see
// and download its files. Admins and employees who can see the task can add files; a
// client can add files only to tasks they created. Admins or the uploader can remove a file.

const ENTITY = "task";

async function visibleTask(taskId: string, user: SessionUser) {
  const task = await getTaskDetail(taskId, user);
  if (!task) throw new Error("That task could not be found.");
  return task;
}

function canAddFiles(user: SessionUser, task: { createdById: string | null }) {
  return user.role !== "CLIENT" || task.createdById === user.id;
}

const taskPrefix = (taskId: string) => storageKey("tasks", taskId);

export async function listTaskAttachments(taskId: string) {
  return prisma.attachment.findMany({
    where: { entityType: ENTITY, entityId: taskId, storageKey: { not: null } },
    select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedById: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export type TaskAttachmentRow = Awaited<ReturnType<typeof listTaskAttachments>>[number];

/** Step 1: check access and type, then return a presigned PUT for the browser. */
export async function requestTaskAttachmentUpload(
  user: SessionUser,
  input: { taskId: string; fileName: string; mimeType: string; size: number },
) {
  const task = await visibleTask(input.taskId, user);
  if (!canAddFiles(user, task)) throw new Error("You can only add files to tasks you created.");
  const contentType = resolveAttachmentType(input.fileName, input.mimeType);
  if (!contentType) throw new Error("Only images (PNG, JPG, WebP, GIF), PDF, Word (DOC, DOCX) and XML files can be attached.");

  const key = `${taskPrefix(task.id)}/${randomUUID()}/${safeFileName(input.fileName)}`;
  return { key, contentType, uploadUrl: await createUploadUrl(key, contentType) };
}

/** Step 2: after the browser upload, verify the object and record it. */
export async function confirmTaskAttachment(user: SessionUser, input: { taskId: string; key: string; fileName: string }) {
  const task = await visibleTask(input.taskId, user);
  if (!canAddFiles(user, task)) throw new Error("You can only add files to tasks you created.");
  if (!isPanelKey(input.key) || !input.key.startsWith(`${taskPrefix(task.id)}/`)) {
    throw new Error("That upload doesn't belong to this task.");
  }

  const head = await headObject(input.key);
  if (!head) throw new Error("The upload didn't reach storage. Please try again.");
  const contentType = head.contentType && ATTACHMENT_TYPES[head.contentType] ? head.contentType : null;
  if (!contentType || head.size > ATTACHMENT_MAX_BYTES) {
    await deleteObjectQuietly(input.key);
    throw new Error("That file isn't allowed.");
  }

  const fileName = input.fileName.trim().slice(0, 200);
  const attachment = await prisma.attachment.create({
    data: {
      fileName,
      fileUrl: storageUrl(input.key),
      fileSize: head.size,
      mimeType: contentType,
      entityType: ENTITY,
      entityId: task.id,
      storageKey: input.key,
      uploadedById: user.id,
    },
  });
  await logActivity({
    type: "task.attachment_added",
    message: `File "${fileName}" attached`,
    entityType: "task",
    entityId: task.id,
    taskId: task.id,
    userId: user.id,
  });
  return attachment.id;
}

async function attachmentForUser(user: SessionUser, attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.entityType !== ENTITY || !attachment.storageKey) throw new Error("That file could not be found.");
  await visibleTask(attachment.entityId, user);
  return attachment as typeof attachment & { storageKey: string };
}

/** A 5-minute download link. Images and PDFs open in the browser; other types download. */
export async function getTaskAttachmentDownloadUrl(user: SessionUser, attachmentId: string) {
  const attachment = await attachmentForUser(user, attachmentId);
  const inline = attachment.mimeType ? ATTACHMENT_TYPES[attachment.mimeType]?.inline ?? false : false;
  return createDownloadUrl(attachment.storageKey, attachment.fileName, {
    inline,
    contentType: attachment.mimeType ?? undefined,
  });
}

export async function deleteTaskAttachment(user: SessionUser, attachmentId: string) {
  const attachment = await attachmentForUser(user, attachmentId);
  if (user.role !== "ADMIN" && attachment.uploadedById !== user.id) {
    throw new Error("Only the person who added this file or an admin can remove it.");
  }
  await prisma.attachment.delete({ where: { id: attachment.id } });
  await deleteObjectQuietly(attachment.storageKey);
  await logActivity({
    type: "task.attachment_removed",
    message: `File "${attachment.fileName}" removed`,
    entityType: "task",
    entityId: attachment.entityId,
    taskId: attachment.entityId,
    userId: user.id,
  });
}
