import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import {
  companionSettingsDefaults,
  companionSettingsBaseSchema,
  companionTeamPolicySchema,
  type CompanionSettingsFormValues,
  type CompanionTeamPolicyValues,
} from "@/lib/validations/companion";

/**
 * Returns a user's companion settings, falling back to defaults for anything missing or
 * malformed (JSON columns are re-validated on read, never trusted).
 */
export async function getCompanionSettings(userId: string, fallbackName = ""): Promise<CompanionSettingsFormValues> {
  const defaults = companionSettingsDefaults(fallbackName);
  const row = await prisma.companionSettings.findUnique({ where: { userId } });
  if (!row) return defaults;

  const shape = companionSettingsBaseSchema.shape;
  const pick = <K extends keyof CompanionSettingsFormValues>(key: K, value: unknown): CompanionSettingsFormValues[K] => {
    const parsed = shape[key].safeParse(value);
    return parsed.success ? (parsed.data as CompanionSettingsFormValues[K]) : defaults[key];
  };

  return {
    mascotName: pick("mascotName", row.mascotName),
    ownerName: pick("ownerName", row.ownerName),
    greeting: pick("greeting", row.greeting),
    timezone: pick("timezone", row.timezone),
    checklist: pick("checklist", row.checklist),
    websites: pick("websites", row.websites),
    slackChannels: pick("slackChannels", row.slackChannels),
    slackKeywords: pick("slackKeywords", row.slackKeywords),
    vipSenders: pick("vipSenders", row.vipSenders),
    urgentKeywords: pick("urgentKeywords", row.urgentKeywords),
    plannerSource: row.plannerSource,
    reminderEnabled: row.reminderEnabled,
    reminderStart: pick("reminderStart", row.reminderStart),
    reminderEnd: pick("reminderEnd", row.reminderEnd),
    reminderDays: pick("reminderDays", row.reminderDays),
  };
}

/** True once the user has saved their companion settings at least once (used by the setup guide). */
export async function hasSavedCompanionSettings(userId: string): Promise<boolean> {
  return (await prisma.companionSettings.count({ where: { userId } })) > 0;
}

export async function updateCompanionSettings(userId: string, values: CompanionSettingsFormValues) {
  return prisma.companionSettings.upsert({
    where: { userId },
    create: { userId, ...values },
    update: values,
  });
}

// ---------------------------------------------------------------------------
// Team policy: which sections employees may use. Admins always get everything.
// ---------------------------------------------------------------------------

export type CompanionSectionKey = "websites" | "slack" | "gmail";

const DEFAULT_POLICY: CompanionTeamPolicyValues = {
  employeeWebsites: true,
  employeeSlack: true,
  employeeGmail: true,
};

export async function getCompanionTeamPolicy(): Promise<CompanionTeamPolicyValues> {
  const row = await prisma.companionTeamPolicy.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_POLICY;
  const parsed = companionTeamPolicySchema.safeParse(row);
  return parsed.success ? parsed.data : DEFAULT_POLICY;
}

export async function updateCompanionTeamPolicy(values: CompanionTeamPolicyValues) {
  return prisma.companionTeamPolicy.upsert({
    where: { id: "default" },
    create: { id: "default", ...values },
    update: values,
  });
}

export function allowedSections(role: UserRole, policy: CompanionTeamPolicyValues): Record<CompanionSectionKey, boolean> {
  if (role === "ADMIN") return { websites: true, slack: true, gmail: true };
  if (role !== "EMPLOYEE") return { websites: false, slack: false, gmail: false };
  return {
    websites: policy.employeeWebsites,
    slack: policy.employeeSlack,
    gmail: policy.employeeGmail,
  };
}

/** Which server-side integrations have their environment variables set (shown as hints in the UI). */
export function integrationEnvStatus() {
  return {
    encryption: Boolean(process.env.COMPANION_ENCRYPTION_KEY),
    slack: Boolean(process.env.SLACK_BOT_TOKEN),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}

/** Public base URL of the panel, used for OAuth redirect URIs and links in the briefing. */
export function companionAppUrl(fallbackOrigin?: string): string {
  const raw = process.env.APP_URL || process.env.NEXTAUTH_URL || fallbackOrigin || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
