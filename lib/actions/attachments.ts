"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { attachmentConfirmSchema, attachmentUploadRequestSchema } from "@/lib/validations/attachments";
import { confirmTaskAttachment, deleteTaskAttachment, requestTaskAttachmentUpload } from "@/lib/services/attachments";
import { isStorageConfigured } from "@/lib/services/storage";

// Task attachments are uploaded in two steps: the browser asks for a presigned S3 URL,
// uploads the file directly to S3, then confirms so the attachment is recorded.

export type AttachmentUploadTicket =
  | { success: true; key: string; uploadUrl: string; contentType: string }
  | { success: false; message: string };

export async function requestTaskAttachmentUploadAction(values: {
  taskId: string;
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<AttachmentUploadTicket> {
  const user = await requirePermission("tasks:edit");
  const parsed = attachmentUploadRequestSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid file." };
  if (!isStorageConfigured()) return { success: false, message: "File storage isn't configured on the server." };
  try {
    return { success: true, ...(await requestTaskAttachmentUpload(user, parsed.data)) };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function confirmTaskAttachmentAction(values: { taskId: string; key: string; fileName: string }): Promise<FormActionResult> {
  const user = await requirePermission("tasks:edit");
  const parsed = attachmentConfirmSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: "Invalid upload." };
  try {
    const id = await confirmTaskAttachment(user, parsed.data);
    revalidatePath(`/tasks/${parsed.data.taskId}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteTaskAttachmentAction(attachmentId: string, taskId: string): Promise<FormActionResult> {
  const user = await requirePermission("tasks:edit");
  const parsed = z.object({ attachmentId: z.string().min(1).max(40), taskId: z.string().min(1).max(40) }).safeParse({ attachmentId, taskId });
  if (!parsed.success) return { success: false, message: "Invalid file." };
  try {
    await deleteTaskAttachment(user, parsed.data.attachmentId);
    revalidatePath(`/tasks/${parsed.data.taskId}`);
    return { success: true, message: "File removed" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
