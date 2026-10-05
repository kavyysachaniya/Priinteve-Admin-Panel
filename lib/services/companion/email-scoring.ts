// Rule-based importance scoring for yesterday's email. Pure functions over message
// metadata (headers and labels only), so they can be tested without Gmail.

export interface EmailMeta {
  from: string;
  to: string;
  cc: string;
  subject: string;
  labelIds: string[];
  hasListUnsubscribe: boolean;
  /** Precedence: bulk/list/junk or Auto-Submitted other than "no". */
  isAutomatedHeader: boolean;
}

export interface ScoreInput {
  meta: EmailMeta;
  /** The connected mailbox's own address. */
  accountEmail: string;
  vipSenders: string[];
  urgentKeywords: string[];
  /** True when the newest message in the thread is not from the account owner. */
  awaitingReply?: boolean;
}

export interface EmailScore {
  score: number;
  reasons: string[];
  bulk: boolean;
}

export const IMPORTANT_THRESHOLD = 3;

const BULK_CATEGORIES = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS", "SPAM"];
const AUTOMATED_SENDER = /(^|[._+-])(no-?reply|do-?not-?reply|notifications?|mailer-daemon|bounce[sd]?|alerts?)([._+-]|@)/i;

/** Extracts lower-cased addresses from a header like `"A" <a@x.com>, b@y.com`. */
export function parseAddresses(header: string): string[] {
  const matches = header.match(/[^\s<>,;"']+@[^\s<>,;"']+/g) ?? [];
  return matches.map((a) => a.toLowerCase());
}

/** Display name from a From header, falling back to the address. */
export function senderName(from: string): string {
  const named = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (named?.[1]) return named[1].trim();
  return parseAddresses(from)[0] ?? from.trim();
}

function matchesVip(address: string, vips: string[]): boolean {
  return vips.some((vip) => (vip.startsWith("@") ? address.endsWith(vip) : address === vip));
}

function containsKeyword(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    const k = keyword.toLowerCase().trim();
    if (!k) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u");
    if (re.test(lower)) return keyword;
  }
  return null;
}

export function isBulk(meta: EmailMeta): boolean {
  const sender = parseAddresses(meta.from)[0] ?? "";
  return (
    meta.hasListUnsubscribe ||
    meta.isAutomatedHeader ||
    meta.labelIds.some((l) => BULK_CATEGORIES.includes(l)) ||
    AUTOMATED_SENDER.test(sender)
  );
}

export function scoreEmail(input: ScoreInput): EmailScore {
  const { meta } = input;
  const account = input.accountEmail.toLowerCase();
  const sender = parseAddresses(meta.from)[0] ?? "";
  const reasons: string[] = [];
  let score = 0;

  if (sender && sender === account) return { score: -100, reasons: ["sent by you"], bulk: false };

  if (sender && matchesVip(sender, input.vipSenders)) {
    score += 5;
    reasons.push("VIP");
  }
  const keyword = containsKeyword(meta.subject, input.urgentKeywords);
  if (keyword) {
    score += 3;
    reasons.push(keyword.toLowerCase());
  }
  if (parseAddresses(meta.to).includes(account)) {
    score += 2;
    reasons.push("sent to you");
  } else if (parseAddresses(meta.cc).includes(account)) {
    score += 1;
  }
  if (input.awaitingReply) {
    score += 2;
    reasons.push("awaiting your reply");
  }
  if (meta.labelIds.includes("IMPORTANT")) score += 1;
  if (meta.labelIds.includes("STARRED")) score += 1;

  // Newsletters, promotions and automated mail always rank below personal mail (score ≥ 0)
  // and never count as important, even from a VIP domain or with an urgent keyword.
  const bulk = isBulk(meta);
  if (bulk) score = Math.min(score - 10, -1);

  return { score, reasons, bulk };
}
