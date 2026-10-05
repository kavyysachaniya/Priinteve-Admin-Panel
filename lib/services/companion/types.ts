// Briefing contract returned by GET /api/companion/briefing.
// Keep in sync with companion/src/shared/briefing.ts in the desktop app.

import type { SessionUser } from "@/lib/auth/session";
import type { CompanionSettingsFormValues } from "@/lib/validations/companion";

export type ItemStatus = "ok" | "warn" | "error" | "todo";
export type Mood = "happy" | "neutral" | "worried";

export type ItemAction = "complete" | "start-timer" | "stop-timer";

export interface BriefingItem {
  label: string;
  detail?: string;
  status: ItemStatus;
  url?: string;
  /** Set on task rows: lets the desktop app act on the task. */
  taskId?: string;
  /** Buttons the desktop app may show on this row. */
  actions?: ItemAction[];
}

export interface BriefingSection {
  key: string;
  title: string;
  status: ItemStatus;
  items: BriefingItem[];
}

export interface Briefing {
  generatedAt: string;
  mascotName: string;
  ownerName: string;
  greeting: string;
  summary: string;
  mood: Mood;
  sections: BriefingSection[];
}

export interface BriefingContext {
  user: SessionUser;
  settings: CompanionSettingsFormValues;
  /** Public base URL of the panel, for links back into it. */
  appUrl: string;
  now: Date;
}

/** What each integration returns: its section plus an optional phrase for the summary line. */
export interface IntegrationResult {
  section: BriefingSection;
  summary?: string;
}

const RANK: Record<ItemStatus, number> = { ok: 0, todo: 1, warn: 2, error: 3 };

/** The worst status among the items (to-do counts as neutral). */
export function worstStatus(items: BriefingItem[], empty: ItemStatus = "ok"): ItemStatus {
  if (items.length === 0) return empty;
  return items.reduce<ItemStatus>((worst, item) => (RANK[item.status] > RANK[worst] ? item.status : worst), "ok");
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** What GET /api/companion/reminder returns: the schedule plus a small project check-in. */
export interface ReminderPayload {
  enabled: boolean;
  /** HH:MM on the person's own PC clock. */
  start: string;
  end: string;
  /** 0 = Sunday .. 6 = Saturday. */
  days: number[];
  /** True when there is nothing worth interrupting for (timer running and nothing due). */
  quiet: boolean;
  briefing: Briefing | null;
}
