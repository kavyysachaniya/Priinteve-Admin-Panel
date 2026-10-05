import { z } from "zod";
import { versionFromInstallerName } from "@/lib/services/companion/versions";

// Settings for the desktop Morning Companion. Every list is capped so one person's
// briefing can't fan out into hundreds of outbound requests.

const keyword = z.string().trim().min(1).max(60);

const websiteUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Enter a full http(s) address without a username or password");

export const companionWebsiteSchema = z.object({
  label: z.string().trim().min(1, "Name the site").max(60),
  url: websiteUrl,
});

export const companionSlackChannelSchema = z.object({
  id: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[CG][A-Z0-9]{8,}$/, "Use the channel ID (starts with C or G), not its name"),
  label: z.string().trim().min(1, "Name the channel").max(60),
});

const vipSender = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^(@[a-z0-9.-]+\.[a-z]{2,}|[^\s@]+@[a-z0-9.-]+\.[a-z]{2,})$/, "Use name@example.com or @example.com");

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_REMINDER_DAYS = [1, 2, 3, 4, 5, 6]; // Monday to Saturday

export const companionSettingsBaseSchema = z.object({
  mascotName: z.string().trim().min(1, "Give the mascot a name").max(30),
  ownerName: z.string().trim().min(1, "Enter the name the mascot should greet").max(60),
  greeting: z.string().trim().min(1, "Enter a greeting").max(80),
  timezone: z.string().trim().max(60).refine(isValidTimezone, "Unknown time zone"),
  checklist: z.array(z.string().trim().min(1).max(120)).max(15, "Up to 15 checklist items"),
  websites: z.array(companionWebsiteSchema).max(20, "Up to 20 websites"),
  slackChannels: z.array(companionSlackChannelSchema).max(10, "Up to 10 channels"),
  slackKeywords: z.array(keyword).max(30, "Up to 30 keywords"),
  vipSenders: z.array(vipSender).max(50, "Up to 50 VIP senders"),
  urgentKeywords: z.array(keyword).max(30, "Up to 30 keywords"),
  plannerSource: z.enum(["MY_TASKS", "ALL_TASKS"]),
  reminderEnabled: z.boolean(),
  reminderStart: z.string().regex(HHMM, "Use HH:MM, e.g. 10:00"),
  reminderEnd: z.string().regex(HHMM, "Use HH:MM, e.g. 19:00"),
  reminderDays: z.array(z.number().int().min(0).max(6)).max(7, "Pick up to 7 days"),
});

export const companionSettingsFormSchema = companionSettingsBaseSchema.refine(
  (v) => !v.reminderEnabled || v.reminderStart < v.reminderEnd,
  { message: "The end time must be after the start time", path: ["reminderEnd"] },
);

export type CompanionSettingsFormValues = z.infer<typeof companionSettingsFormSchema>;

export const DEFAULT_SLACK_KEYWORDS = ["error", "failed", "exception", "down"];
export const DEFAULT_URGENT_KEYWORDS = ["payment", "invoice", "order", "deadline"];

export function companionSettingsDefaults(ownerName = ""): CompanionSettingsFormValues {
  return {
    mascotName: "Inky",
    ownerName,
    greeting: "Good morning",
    timezone: "Asia/Kolkata",
    checklist: [],
    websites: [],
    slackChannels: [],
    slackKeywords: DEFAULT_SLACK_KEYWORDS,
    vipSenders: [],
    urgentKeywords: DEFAULT_URGENT_KEYWORDS,
    plannerSource: "MY_TASKS",
    reminderEnabled: true,
    reminderStart: "10:00",
    reminderEnd: "19:00",
    reminderDays: DEFAULT_REMINDER_DAYS,
  };
}

export const companionTeamPolicySchema = z.object({
  employeeWebsites: z.boolean(),
  employeeSlack: z.boolean(),
  employeeGmail: z.boolean(),
});

export const INSTALLER_MAX_BYTES = 500 * 1024 * 1024;

export const companionInstallerUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .refine((name) => name.toLowerCase().endsWith(".exe"), "Upload the Windows installer (.exe)")
    .refine(
      (name) => versionFromInstallerName(name) !== null,
      "Keep the file name Priinteve-Companion-Setup-x.y.z.exe (it carries the version)",
    ),
  size: z.number().int().positive().max(INSTALLER_MAX_BYTES, "The installer must be under 500 MB"),
  sha256: z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/, "Couldn't read the file checksum"),
});

export type CompanionTeamPolicyValues = z.infer<typeof companionTeamPolicySchema>;

export const companionDeviceNameSchema = z.object({
  name: z.string().trim().min(1, "Name this computer").max(60),
});

export const companionAccountLabelSchema = z.string().trim().min(1, "Enter a label").max(40);
