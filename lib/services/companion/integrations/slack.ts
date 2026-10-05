import { plural, truncate, worstStatus, type BriefingContext, type BriefingItem, type IntegrationResult } from "@/lib/services/companion/types";

// Counts error messages from the last 24 hours in the user's channels, through the
// workspace bot token (SLACK_BOT_TOKEN). Message text is used only for matching and the
// short sample in the briefing; it is never logged or stored.

const SLACK_API = "https://slack.com/api";
const TIMEOUT_MS = 8_000;
const MAX_PAGES = 3;
const SAMPLE_LENGTH = 120;

interface SlackMessage {
  ts: string;
  text?: string;
  attachments?: Array<{ text?: string; fallback?: string; title?: string; pretext?: string }>;
}

interface SlackHistory {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
}

async function slackGet<T>(method: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${SLACK_API}/${method}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 429) throw new Error("Slack rate limit reached");
  if (!res.ok) throw new Error(`Slack returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildKeywordMatcher(keywords: string[]): RegExp | null {
  const terms = keywords.map((k) => k.trim()).filter(Boolean);
  if (terms.length === 0) return null;
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${terms.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function messageText(message: SlackMessage): string {
  const parts = [message.text ?? ""];
  for (const a of message.attachments ?? []) parts.push(a.pretext ?? "", a.title ?? "", a.text ?? a.fallback ?? "");
  return parts.filter(Boolean).join(" ");
}

/** Turns Slack markup (<url|label>, <@U123>, <!here>) into plain text for the sample. */
export function plainSlackText(text: string): string {
  return text
    .replace(/<([^>|]+)\|([^>]+)>/g, "$2")
    .replace(/<[@#!]([^>]+)>/g, "@$1")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/[*_~`]/g, "");
}

async function scanChannel(channelId: string, oldest: string, matcher: RegExp, token: string) {
  let cursor: string | undefined;
  let count = 0;
  let latest: SlackMessage | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const history = await slackGet<SlackHistory>(
      "conversations.history",
      { channel: channelId, oldest, limit: "200", ...(cursor ? { cursor } : {}) },
      token,
    );
    if (!history.ok) throw new SlackApiError(history.error ?? "unknown_error");
    for (const message of history.messages ?? []) {
      if (!matcher.test(messageText(message))) continue;
      count++;
      if (!latest || Number(message.ts) > Number(latest.ts)) latest = message;
    }
    cursor = history.response_metadata?.next_cursor;
    if (!history.has_more || !cursor) break;
  }
  return { count, latest };
}

class SlackApiError extends Error {}

const SLACK_ERROR_HINTS: Record<string, string> = {
  not_in_channel: "Invite the bot to this channel (/invite @your-bot)",
  channel_not_found: "Channel not found. Check the ID and that the bot was invited",
  invalid_auth: "The Slack bot token is invalid",
  token_revoked: "The Slack bot token was revoked",
  missing_scope: "The bot needs channels:history and groups:history",
};

async function permalink(channel: string, ts: string, token: string): Promise<string> {
  try {
    const res = await slackGet<{ ok: boolean; permalink?: string }>("chat.getPermalink", { channel, message_ts: ts }, token);
    if (res.ok && res.permalink) return res.permalink;
  } catch {
    // Fall through to the channel link.
  }
  return `https://slack.com/app_redirect?channel=${encodeURIComponent(channel)}`;
}

export async function slackIntegration(ctx: BriefingContext): Promise<IntegrationResult | null> {
  const channels = ctx.settings.slackChannels;
  if (channels.length === 0) return null;

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return {
      section: {
        key: "slack",
        title: "Slack",
        status: "warn",
        items: [{ label: "Slack isn't connected on the server", detail: "Ask an admin to set SLACK_BOT_TOKEN", status: "warn" }],
      },
    };
  }

  const matcher = buildKeywordMatcher(ctx.settings.slackKeywords);
  if (!matcher) {
    return {
      section: {
        key: "slack",
        title: "Slack",
        status: "warn",
        items: [{ label: "No error keywords set", detail: "Add keywords on the Companion page", status: "warn" }],
      },
    };
  }

  const oldest = String(Math.floor((ctx.now.getTime() - 24 * 60 * 60 * 1000) / 1000));
  let totalErrors = 0;

  const items = await Promise.all(
    channels.map(async (channel): Promise<BriefingItem> => {
      const name = channel.label.startsWith("#") ? channel.label : `#${channel.label}`;
      try {
        const { count, latest } = await scanChannel(channel.id, oldest, matcher, token);
        totalErrors += count;
        if (count === 0 || !latest) {
          return {
            label: `${name}: no errors in 24 h`,
            status: "ok",
            url: `https://slack.com/app_redirect?channel=${channel.id}`,
          };
        }
        return {
          label: `${name}: ${plural(count, "error")} in 24 h`,
          detail: `Latest: "${truncate(plainSlackText(messageText(latest)), SAMPLE_LENGTH)}"`,
          status: "error",
          url: await permalink(channel.id, latest.ts, token),
        };
      } catch (err) {
        const hint = err instanceof SlackApiError ? SLACK_ERROR_HINTS[err.message] ?? `Slack said: ${err.message}` : "Slack didn't respond";
        console.warn(`[companion] Slack check failed for a channel: ${err instanceof Error ? err.message : "unknown"}`);
        return { label: `${name}: couldn't check`, detail: hint, status: "warn" };
      }
    }),
  );

  return {
    section: { key: "slack", title: "Slack", status: worstStatus(items), items },
    summary: totalErrors > 0 ? `Slack had ${plural(totalErrors, "error")} in the last day` : undefined,
    notable: items.some((i) => i.status !== "ok"),
  };
}
