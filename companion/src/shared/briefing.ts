// Briefing contract shared with the panel endpoint (`GET /api/companion/briefing`).
// Keep in sync with `lib/services/companion/types.ts` in the panel.

export type ItemStatus = "ok" | "warn" | "error" | "todo";
export type Mood = "happy" | "neutral" | "worried";

export interface BriefingItem {
  label: string;
  detail?: string;
  status: ItemStatus;
  url?: string;
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
