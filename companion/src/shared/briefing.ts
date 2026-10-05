// Briefing contract shared with the panel endpoint (`GET /api/companion/briefing`).
// Keep in sync with `lib/services/companion/types.ts` in the panel.

export type ItemStatus = "ok" | "warn" | "error" | "todo";
export type Mood = "happy" | "neutral" | "worried";

export type ItemAction = "complete" | "start-timer" | "stop-timer";

export interface BriefingItem {
  label: string;
  detail?: string;
  status: ItemStatus;
  url?: string;
  /** Present on task rows, so the app can act on the task. */
  taskId?: string;
  /** Buttons to show on this row. */
  actions?: ItemAction[];
  /** True when the person's running timer is on this task. */
  running?: boolean;
}

const ACTIONS: ItemAction[] = ["complete", "start-timer", "stop-timer"];

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
  /** Set by the desktop app when it is showing a cached or fallback briefing. */
  offline?: boolean;
  offlineNote?: string;
}

const STATUSES: ItemStatus[] = ["ok", "warn", "error", "todo"];
const MOODS: Mood[] = ["happy", "neutral", "worried"];

function str(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function status(value: unknown): ItemStatus {
  return STATUSES.includes(value as ItemStatus) ? (value as ItemStatus) : "warn";
}

/** Defensive parse: never trust the shape of what came over the network or from disk. */
export function parseBriefing(input: unknown): Briefing | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.sections)) return null;

  const sections: BriefingSection[] = raw.sections.slice(0, 20).flatMap((s): BriefingSection[] => {
    if (!s || typeof s !== "object") return [];
    const sec = s as Record<string, unknown>;
    const items = Array.isArray(sec.items) ? sec.items : [];
    return [
      {
        key: str(sec.key, 40, "section"),
        title: str(sec.title, 80, "Section"),
        status: status(sec.status),
        items: items.slice(0, 30).flatMap((i): BriefingItem[] => {
          if (!i || typeof i !== "object") return [];
          const item = i as Record<string, unknown>;
          return [
            {
              label: str(item.label, 200, "—"),
              detail: str(item.detail, 300) || undefined,
              status: status(item.status),
              url: safeUrl(item.url),
              taskId: typeof item.taskId === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(item.taskId) ? item.taskId : undefined,
              running: item.running === true ? true : undefined,
              actions: Array.isArray(item.actions)
                ? item.actions.filter((a): a is ItemAction => ACTIONS.includes(a as ItemAction)).slice(0, 3)
                : undefined,
            },
          ];
        }),
      },
    ];
  });

  return {
    generatedAt: str(raw.generatedAt, 40, new Date().toISOString()),
    mascotName: str(raw.mascotName, 40, "Inky"),
    ownerName: str(raw.ownerName, 60, "there"),
    greeting: str(raw.greeting, 120, "Good morning"),
    summary: str(raw.summary, 300),
    mood: MOODS.includes(raw.mood as Mood) ? (raw.mood as Mood) : "neutral",
    sections,
    offline: raw.offline === true ? true : undefined,
    offlineNote: str(raw.offlineNote, 200) || undefined,
  };
}

// ---------------------------------------------------------------------------
// Project reminder (GET /api/companion/reminder)
// ---------------------------------------------------------------------------

export interface ReminderPayload {
  enabled: boolean;
  /** HH:MM on this computer's clock. */
  start: string;
  end: string;
  /** 0 = Sunday .. 6 = Saturday. */
  days: number[];
  quiet: boolean;
  briefing: Briefing | null;
}

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function parseReminder(input: unknown): ReminderPayload | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.enabled !== "boolean") return null;
  const start = typeof raw.start === "string" && HHMM.test(raw.start) ? raw.start : "10:00";
  const end = typeof raw.end === "string" && HHMM.test(raw.end) ? raw.end : "19:00";
  const days = Array.isArray(raw.days)
    ? raw.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : [1, 2, 3, 4, 5, 6];
  return {
    enabled: raw.enabled,
    start,
    end,
    days,
    quiet: raw.quiet === true,
    briefing: raw.briefing ? parseBriefing(raw.briefing) : null,
  };
}

/** Is `now` (this computer's local time) inside the work window on a work day? */
export function isWithinWorkHours(now: Date, schedule: Pick<ReminderPayload, "start" | "end" | "days">): boolean {
  if (!schedule.days.includes(now.getDay())) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  return minutes >= toMinutes(schedule.start) && minutes < toMinutes(schedule.end);
}

/** Milliseconds until the next :00 or :30 on this computer's clock (at least one second). */
export function msUntilNextTick(now: Date = new Date()): number {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(now.getMinutes() < 30 ? 30 : 60);
  return Math.max(1000, next.getTime() - now.getTime());
}

// ---------------------------------------------------------------------------
// Auto-update (GET /api/companion/update?current=x.y.z)
// ---------------------------------------------------------------------------

export interface UpdateInfo {
  version: string;
  sha256: string;
  size?: number;
  url: string;
}

export function parseUpdateInfo(input: unknown): UpdateInfo | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (raw.updateAvailable !== true) return null;
  const version = typeof raw.version === "string" && /^\d+\.\d+\.\d+$/.test(raw.version) ? raw.version : null;
  const sha256 = typeof raw.sha256 === "string" && /^[a-f0-9]{64}$/.test(raw.sha256) ? raw.sha256 : null;
  const url = typeof raw.url === "string" ? raw.url : null;
  if (!version || !sha256 || !url) return null;
  try {
    const u = new URL(url);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return null;
  } catch {
    return null;
  }
  const size = typeof raw.size === "number" && raw.size > 0 && raw.size <= 500 * 1024 * 1024 ? raw.size : undefined;
  return { version, sha256, size, url };
}

/** > 0 when a is newer than b. Both must be x.y.z; anything else compares as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  if (pa.length !== 3 || pb.length !== 3 || [...pa, ...pb].some(Number.isNaN)) return 0;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

// ---------------------------------------------------------------------------
// Live state (GET /api/companion/live?tasks=a,b)
// ---------------------------------------------------------------------------

export type LiveTaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface LivePayload {
  /** The person's running timer, if any (taskId is null for a project timer without a task). */
  timer: { taskId: string | null; projectName: string; taskTitle: string | null; startedAt: string } | null;
  tasks: Record<string, LiveTaskStatus>;
}

const LIVE_STATUSES: LiveTaskStatus[] = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export function parseLive(input: unknown): LivePayload | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!raw.tasks || typeof raw.tasks !== "object") return null;

  const tasks: Record<string, LiveTaskStatus> = {};
  for (const [id, value] of Object.entries(raw.tasks as Record<string, unknown>).slice(0, 60)) {
    if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && LIVE_STATUSES.includes(value as LiveTaskStatus)) tasks[id] = value as LiveTaskStatus;
  }

  let timer: LivePayload["timer"] = null;
  const t = raw.timer;
  if (t && typeof t === "object") {
    const o = t as Record<string, unknown>;
    const startedAt = typeof o.startedAt === "string" && !Number.isNaN(Date.parse(o.startedAt)) ? o.startedAt : null;
    if (startedAt) {
      timer = {
        taskId: typeof o.taskId === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(o.taskId) ? o.taskId : null,
        projectName: typeof o.projectName === "string" ? o.projectName.slice(0, 120) : "",
        taskTitle: typeof o.taskTitle === "string" ? o.taskTitle.slice(0, 200) : null,
        startedAt,
      };
    }
  }
  return { timer, tasks };
}
