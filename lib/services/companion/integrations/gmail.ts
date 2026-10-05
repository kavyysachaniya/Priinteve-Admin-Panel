import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { GoogleReconnectError, gmailGet, refreshGoogleAccessToken } from "@/lib/services/companion/google";
import { IMPORTANT_THRESHOLD, scoreEmail, senderName, type EmailMeta } from "@/lib/services/companion/email-scoring";
import { zonedDay } from "@/lib/services/companion/time";
import { plural, truncate, worstStatus, type BriefingContext, type BriefingItem, type IntegrationResult } from "@/lib/services/companion/types";

// Multi-account Gmail, read-only. Uses message metadata (headers + labels) only; bodies
// are never requested. Subjects appear in the user's own briefing but are never logged.

const MAX_MESSAGES_PER_ACCOUNT = 100;
const MAX_THREAD_CHECKS = 10;
const TOP_EMAILS = 5;
const CONCURRENCY = 8;

const METADATA_HEADERS = ["From", "To", "Cc", "Subject", "List-Unsubscribe", "Precedence", "Auto-Submitted"];

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  payload?: { headers?: Array<{ name: string; value: string }> };
}

interface Ranked {
  accountLabel: string;
  accountEmail: string;
  threadId: string;
  subject: string;
  from: string;
  score: number;
  reasons: string[];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await fn(items[index]);
      }
    }),
  );
  return out;
}

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function toMeta(message: GmailMessage): EmailMeta {
  const precedence = header(message, "Precedence").toLowerCase();
  const autoSubmitted = header(message, "Auto-Submitted").toLowerCase();
  return {
    from: header(message, "From"),
    to: header(message, "To"),
    cc: header(message, "Cc"),
    subject: header(message, "Subject"),
    labelIds: message.labelIds ?? [],
    hasListUnsubscribe: Boolean(header(message, "List-Unsubscribe")),
    isAutomatedHeader: ["bulk", "list", "junk"].includes(precedence) || (autoSubmitted !== "" && autoSubmitted !== "no"),
  };
}

function threadUrl(email: string, threadId: string) {
  return `https://mail.google.com/mail/u/${encodeURIComponent(email)}/#all/${threadId}`;
}

async function markNeedsReconnect(id: string, reason: string) {
  await prisma.companionGmailAccount
    .update({ where: { id }, data: { status: "NEEDS_RECONNECT", lastError: reason } })
    .catch(() => undefined);
}

async function awaitingReply(accessToken: string, threadId: string, accountEmail: string): Promise<boolean> {
  const thread = await gmailGet<{ messages?: GmailMessage[] }>(accessToken, `/threads/${threadId}`, {
    format: "metadata",
    metadataHeaders: ["From"],
  });
  const last = thread.messages?.at(-1);
  if (!last) return false;
  return !header(last, "From").toLowerCase().includes(accountEmail.toLowerCase());
}

type Account = {
  id: string;
  label: string;
  email: string;
  excludeFromProcessing: boolean;
  encRefreshToken: string;
};

async function scanAccount(account: Account, ctx: BriefingContext) {
  const accessToken = await refreshGoogleAccessToken(decryptSecret(account.encRefreshToken));

  const inbox = await gmailGet<{ messagesUnread?: number }>(accessToken, "/labels/INBOX");
  const unread = inbox.messagesUnread ?? 0;
  if (account.excludeFromProcessing) return { unread, important: null as number | null, ranked: [] as Ranked[] };

  const yesterday = zonedDay(ctx.settings.timezone, -1, ctx.now);
  const after = Math.floor(yesterday.start.getTime() / 1000);
  const before = Math.floor(yesterday.end.getTime() / 1000);
  const list = await gmailGet<{ messages?: Array<{ id: string; threadId: string }> }>(accessToken, "/messages", {
    q: `after:${after} before:${before} -in:sent -in:chats -in:spam -in:trash`,
    maxResults: String(MAX_MESSAGES_PER_ACCOUNT),
  });

  const messages = await mapLimit(list.messages ?? [], CONCURRENCY, (m) =>
    gmailGet<GmailMessage>(accessToken, `/messages/${m.id}`, { format: "metadata", metadataHeaders: METADATA_HEADERS }),
  );

  const scoreInput = { accountEmail: account.email, vipSenders: ctx.settings.vipSenders, urgentKeywords: ctx.settings.urgentKeywords };
  const scored = messages.map((message) => ({ message, meta: toMeta(message), ...scoreEmail({ meta: toMeta(message), ...scoreInput }) }));

  // Best message per thread, then check "awaiting your reply" for the strongest human candidates.
  const byThread = new Map<string, (typeof scored)[number]>();
  for (const s of scored) {
    const existing = byThread.get(s.message.threadId);
    if (!existing || s.score > existing.score) byThread.set(s.message.threadId, s);
  }
  const candidates = [...byThread.values()].filter((s) => !s.bulk && s.score > -100).sort((a, b) => b.score - a.score);
  await mapLimit(candidates.slice(0, MAX_THREAD_CHECKS), CONCURRENCY, async (candidate) => {
    const waiting = await awaitingReply(accessToken, candidate.message.threadId, account.email).catch(() => false);
    if (waiting) Object.assign(candidate, scoreEmail({ meta: candidate.meta, ...scoreInput, awaitingReply: true }));
  });

  const ranked: Ranked[] = [...byThread.values()]
    .filter((s) => s.score >= IMPORTANT_THRESHOLD)
    .map((s) => ({
      accountLabel: account.label,
      accountEmail: account.email,
      threadId: s.message.threadId,
      subject: s.meta.subject || "(no subject)",
      from: senderName(s.meta.from),
      score: s.score,
      reasons: s.reasons,
    }));

  return { unread, important: ranked.length, ranked };
}

export async function gmailIntegration(ctx: BriefingContext): Promise<IntegrationResult | null> {
  const accounts = await prisma.companionGmailAccount.findMany({
    where: { userId: ctx.user.id, enabled: true },
    select: { id: true, label: true, email: true, excludeFromProcessing: true, encRefreshToken: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  if (accounts.length === 0) return null;

  const reconnectUrl = `${ctx.appUrl}/companion#gmail`;
  const accountItems: BriefingItem[] = [];
  const allRanked: Ranked[] = [];
  let importantTotal = 0;

  await Promise.all(
    accounts.map(async (account, index) => {
      if (account.status === "NEEDS_RECONNECT") {
        accountItems[index] = { label: `${account.label}: reconnect needed`, detail: account.email, status: "warn", url: reconnectUrl };
        return;
      }
      try {
        const result = await scanAccount(account, ctx);
        const parts = [`${result.unread} unread`];
        if (result.important !== null) parts.push(`${result.important} important yesterday`);
        accountItems[index] = {
          label: `${account.label}: ${parts.join(" · ")}`,
          detail: account.excludeFromProcessing ? "Counts only (private inbox)" : undefined,
          status: "ok",
          url: `https://mail.google.com/mail/u/${encodeURIComponent(account.email)}/#inbox`,
        };
        importantTotal += result.important ?? 0;
        allRanked.push(...result.ranked);
      } catch (err) {
        if (err instanceof GoogleReconnectError) {
          await markNeedsReconnect(account.id, "Google access expired or was revoked");
          accountItems[index] = { label: `${account.label}: reconnect needed`, detail: account.email, status: "warn", url: reconnectUrl };
          return;
        }
        console.warn(`[companion] Gmail check failed for an account: ${err instanceof Error ? err.message : "unknown"}`);
        accountItems[index] = { label: `${account.label}: couldn't check`, detail: "Gmail didn't respond", status: "warn" };
      }
    }),
  );

  const top = allRanked
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_EMAILS)
    .map<BriefingItem>((r) => ({
      label: truncate(r.subject, 90),
      detail: [r.accountLabel, `from ${truncate(r.from, 40)}`, ...r.reasons.filter((x) => x === "awaiting your reply" || x === "VIP")].join(" · "),
      status: "todo",
      url: threadUrl(r.accountEmail, r.threadId),
    }));

  const items = [...accountItems, ...top];
  return {
    section: { key: "gmail", title: "Email", status: worstStatus(accountItems), items },
    summary: importantTotal > 0 ? `${plural(importantTotal, "important email")} from yesterday` : undefined,
  };
}
