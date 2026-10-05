import type { SessionUser } from "@/lib/auth/session";
import {
  allowedSections,
  companionAppUrl,
  getCompanionSettings,
  getCompanionTeamPolicy,
  type CompanionSectionKey,
} from "@/lib/services/companion/settings";
import { websitesIntegration } from "@/lib/services/companion/integrations/websites";
import { slackIntegration } from "@/lib/services/companion/integrations/slack";
import { gmailIntegration } from "@/lib/services/companion/integrations/gmail";
import { tasksIntegration } from "@/lib/services/companion/integrations/tasks";
import type { Briefing, BriefingContext, BriefingSection, IntegrationResult, Mood } from "@/lib/services/companion/types";

// Builds one user's morning briefing. Every integration runs in parallel with its own
// time limit; a failure becomes an amber "unavailable" section instead of failing the
// whole briefing.

const INTEGRATION_TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 60_000;

interface Integration {
  key: string;
  title: string;
  section?: CompanionSectionKey;
  run: (ctx: BriefingContext) => Promise<IntegrationResult | null>;
}

const INTEGRATIONS: Integration[] = [
  { key: "websites", title: "Websites", section: "websites", run: websitesIntegration },
  { key: "slack", title: "Slack", section: "slack", run: slackIntegration },
  { key: "gmail", title: "Email", section: "gmail", run: gmailIntegration },
  { key: "tasks", title: "Today", run: tasksIntegration },
];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function unavailable(integration: Integration, reason: string): BriefingSection {
  return {
    key: integration.key,
    title: integration.title,
    status: "warn",
    items: [{ label: `${integration.title} check unavailable`, detail: reason, status: "warn" }],
  };
}

function moodFor(sections: BriefingSection[]): Mood {
  if (sections.some((s) => s.status === "error")) return "worried";
  if (sections.some((s) => s.status === "warn")) return "neutral";
  return "happy";
}

function buildSummary(parts: string[], mood: Mood): string {
  if (parts.length === 0) return mood === "happy" ? "All quiet. Have a great day!" : "A few things need a look.";
  const sentence = parts.join(", ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

// Short per-instance cache so repeated Refresh clicks don't hammer Gmail and Slack.
const cache = new Map<string, { at: number; briefing: Briefing }>();

export async function buildBriefing(user: SessionUser, options: { origin?: string; fresh?: boolean } = {}): Promise<Briefing> {
  const cached = cache.get(user.id);
  if (!options.fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.briefing;

  const [settings, policy] = await Promise.all([getCompanionSettings(user.id, user.name), getCompanionTeamPolicy()]);
  const allowed = allowedSections(user.role, policy);
  const ctx: BriefingContext = { user, settings, appUrl: companionAppUrl(options.origin), now: new Date() };

  const active = INTEGRATIONS.filter((i) => !i.section || allowed[i.section]);
  const results = await Promise.allSettled(active.map((i) => withTimeout(i.run(ctx), INTEGRATION_TIMEOUT_MS)));

  const sections: BriefingSection[] = [];
  const summaryParts: string[] = [];
  results.forEach((result, index) => {
    const integration = active[index];
    if (result.status === "fulfilled") {
      if (!result.value) return;
      sections.push(result.value.section);
      if (result.value.summary) summaryParts.push(result.value.summary);
    } else {
      const reason = result.reason instanceof Error && result.reason.message === "timed out" ? "It took too long to respond" : "Something went wrong";
      // Log the integration and error type only, never message content.
      console.error(`[companion] ${integration.key} integration failed:`, result.reason instanceof Error ? result.reason.message : "unknown");
      sections.push(unavailable(integration, reason));
    }
  });

  const mood = moodFor(sections);
  const briefing: Briefing = {
    generatedAt: ctx.now.toISOString(),
    mascotName: settings.mascotName,
    ownerName: settings.ownerName || user.name,
    greeting: settings.greeting,
    summary: buildSummary(summaryParts, mood),
    mood,
    sections,
  };
  cache.set(user.id, { at: Date.now(), briefing });
  return briefing;
}

/** Drop a user's cached briefing (after they change settings or accounts). */
export function invalidateBriefingCache(userId: string) {
  cache.delete(userId);
}
