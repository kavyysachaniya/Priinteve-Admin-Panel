"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import {
  companionAccountLabelSchema,
  companionDeviceNameSchema,
  companionInstallerUploadSchema,
  companionSettingsFormSchema,
  companionTeamPolicySchema,
  type CompanionSettingsFormValues,
  type CompanionTeamPolicyValues,
} from "@/lib/validations/companion";
import { updateCompanionSettings, updateCompanionTeamPolicy } from "@/lib/services/companion/settings";
import { createDevice, revokeDevice } from "@/lib/services/companion/devices";
import { deleteGmailAccount, updateGmailAccount } from "@/lib/services/companion/accounts";
import { confirmInstallerUpload, requestInstallerUpload } from "@/lib/services/companion/installer";
import { isStorageConfigured } from "@/lib/services/storage";
import { invalidateBriefingCache } from "@/lib/services/companion/briefing";

const idSchema = z.string().trim().min(1).max(40);

function done(userId: string): FormActionResult {
  invalidateBriefingCache(userId);
  revalidatePath("/companion");
  return { success: true };
}

export async function updateCompanionSettingsAction(values: CompanionSettingsFormValues): Promise<FormActionResult> {
  const user = await requirePermission("companion:use");
  const parsed = companionSettingsFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    // "All tasks" is an admin-only view; everyone else always gets their own tasks.
    const data = { ...parsed.data, plannerSource: user.role === "ADMIN" ? parsed.data.plannerSource : "MY_TASKS" as const };
    await updateCompanionSettings(user.id, data);
    return done(user.id);
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateCompanionTeamPolicyAction(values: CompanionTeamPolicyValues): Promise<FormActionResult> {
  await requirePermission("companion:manage");
  const parsed = companionTeamPolicySchema.safeParse(values);
  if (!parsed.success) return { success: false, message: "Invalid team settings." };
  try {
    await updateCompanionTeamPolicy(parsed.data);
    revalidatePath("/companion");
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

/** Returns the new device token once, in `message`. It can't be shown again. */
export async function createCompanionDeviceAction(values: { name: string }): Promise<FormActionResult> {
  const user = await requirePermission("companion:use");
  const parsed = companionDeviceNameSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const { id, token } = await createDevice(user.id, parsed.data.name);
    revalidatePath("/companion");
    return { success: true, id, message: token };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function revokeCompanionDeviceAction(id: string): Promise<FormActionResult> {
  const user = await requirePermission("companion:use");
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { success: false, message: "Invalid device." };
  try {
    await revokeDevice(user.id, parsed.data);
    revalidatePath("/companion");
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

const gmailUpdateSchema = z.object({
  id: idSchema,
  enabled: z.boolean().optional(),
  excludeFromProcessing: z.boolean().optional(),
  label: companionAccountLabelSchema.optional(),
});

export async function updateGmailAccountAction(values: z.infer<typeof gmailUpdateSchema>): Promise<FormActionResult> {
  const user = await requirePermission("companion:use");
  const parsed = gmailUpdateSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: "Invalid account settings." };
  try {
    const { id, ...data } = parsed.data;
    await updateGmailAccount(user.id, id, data);
    return done(user.id);
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteGmailAccountAction(id: string): Promise<FormActionResult> {
  const user = await requirePermission("companion:use");
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { success: false, message: "Invalid account." };
  try {
    await deleteGmailAccount(user.id, parsed.data);
    return done(user.id);
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

// ---------------------------------------------------------------------------
// Windows installer (S3). Two steps: get a presigned upload URL, then confirm after the
// browser has uploaded, so the record only changes once the file is really in storage.
// ---------------------------------------------------------------------------

export type InstallerUploadTicket =
  | { success: true; key: string; uploadUrl: string; contentType: string }
  | { success: false; message: string };

export async function requestInstallerUploadAction(values: { fileName: string; size: number; sha256: string }): Promise<InstallerUploadTicket> {
  await requirePermission("companion:manage");
  const parsed = companionInstallerUploadSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid file." };
  if (!isStorageConfigured()) return { success: false, message: "File storage isn't configured on the server." };
  try {
    return { success: true, ...(await requestInstallerUpload(parsed.data.fileName)) };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

const installerConfirmSchema = z.object({
  key: z.string().trim().min(1).max(400),
  fileName: z.string().trim().min(1).max(150),
  sha256: z.string().trim().toLowerCase().length(64),
});

export async function confirmInstallerUploadAction(values: { key: string; fileName: string; sha256: string }): Promise<FormActionResult> {
  const user = await requirePermission("companion:manage");
  const parsed = installerConfirmSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: "Invalid upload." };
  try {
    await confirmInstallerUpload(user.id, parsed.data.key, parsed.data.fileName, parsed.data.sha256);
    revalidatePath("/companion");
    return { success: true };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
