// Offline checks for the Morning Companion: email scoring, time-zone day boundaries,
// SSRF address blocking, Slack keyword matching, secret encryption, and website
// classification against a throwaway local HTTP server. No database, no external network.
//
//   npx tsx scripts/test-companion.ts

import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";

process.env.COMPANION_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  const { scoreEmail, isBulk, parseAddresses, senderName, IMPORTANT_THRESHOLD } = await import("../lib/services/companion/email-scoring");
  const { zonedDay } = await import("../lib/services/companion/time");
  const { isBlockedAddress } = await import("../lib/services/companion/net");
  const { buildKeywordMatcher, plainSlackText } = await import("../lib/services/companion/integrations/slack");
  const { encryptSecret, decryptSecret, hashToken, safeEqual } = await import("../lib/crypto");

  console.log("=== Companion offline checks ===");

  // 1. Email scoring --------------------------------------------------------
  const base = {
    from: '"Riya Mehta" <riya@client.com>',
    to: "owner@priinteve.com",
    cc: "",
    subject: "Invoice for last week's order",
    labelIds: ["INBOX", "UNREAD"],
    hasListUnsubscribe: false,
    isAutomatedHeader: false,
  };
  const ctx = { accountEmail: "owner@priinteve.com", vipSenders: ["@client.com"], urgentKeywords: ["payment", "invoice", "order", "deadline"] };

  const vip = scoreEmail({ meta: base, ...ctx, awaitingReply: true });
  assert(vip.score === 5 + 3 + 2 + 2, `VIP + keyword + direct + awaiting should be 12, got ${vip.score}`);
  assert(vip.score >= IMPORTANT_THRESHOLD, "VIP email should be important");

  const newsletter = scoreEmail({ meta: { ...base, hasListUnsubscribe: true, labelIds: ["CATEGORY_PROMOTIONS"] }, ...ctx });
  assert(newsletter.bulk && newsletter.score < 0, "Newsletter should rank last");

  const noreply = { ...base, from: "Shop <no-reply@shop.example>", subject: "Your order has shipped" };
  assert(isBulk(noreply), "no-reply sender should count as automated");

  const self = scoreEmail({ meta: { ...base, from: "Me <owner@priinteve.com>" }, ...ctx });
  assert(self.score < 0, "Own sent mail should never rank");

  const plain = scoreEmail({ meta: { ...base, from: "a@b.com", subject: "Hello", to: "team@priinteve.com" }, vipSenders: [], urgentKeywords: [], accountEmail: ctx.accountEmail });
  assert(plain.score < IMPORTANT_THRESHOLD, "A plain mail to a group alias isn't important");

  const partialWord = scoreEmail({ meta: { ...base, from: "a@b.com", subject: "Reordering shelves" }, vipSenders: [], urgentKeywords: ["order"], accountEmail: "x@y.com" });
  assert(!partialWord.reasons.includes("order"), "Keyword must match at a word start, not inside 'Reordering'");

  assert(parseAddresses('"A" <A@X.com>, b@y.com').join() === "a@x.com,b@y.com", "parseAddresses");
  assert(senderName('"Riya Mehta" <riya@client.com>') === "Riya Mehta", "senderName");
  console.log("1) Email scoring ✓");

  // 2. Time-zone days -------------------------------------------------------
  const now = new Date("2026-10-05T02:00:00Z"); // 07:30 IST
  const today = zonedDay("Asia/Kolkata", 0, now);
  const yesterday = zonedDay("Asia/Kolkata", -1, now);
  assert(today.key === "2026-10-05", `IST today key, got ${today.key}`);
  assert(today.start.toISOString() === "2026-10-04T18:30:00.000Z", `IST start, got ${today.start.toISOString()}`);
  assert(today.end.toISOString() === "2026-10-05T18:30:00.000Z", `IST end, got ${today.end.toISOString()}`);
  assert(yesterday.key === "2026-10-04", "IST yesterday key");
  const late = zonedDay("Asia/Kolkata", 0, new Date("2026-10-05T20:00:00Z")); // 01:30 IST on the 6th
  assert(late.key === "2026-10-06", `After IST midnight should be the 6th, got ${late.key}`);
  const ny = zonedDay("America/New_York", 0, new Date("2026-03-08T12:00:00Z")); // DST change day
  assert(ny.end.getTime() - ny.start.getTime() === 23 * 3600 * 1000, "DST spring-forward day is 23 hours");
  console.log("2) Time-zone day boundaries ✓");

  // 3. SSRF blocking ----------------------------------------------------------
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert(isBlockedAddress(ip), `${ip} should be blocked`);
  }
  for (const ip of ["8.8.8.8", "76.76.21.21", "2606:4700:4700::1111"]) {
    assert(!isBlockedAddress(ip), `${ip} should be allowed`);
  }
  console.log("3) Private address blocking ✓");

  // 4. Slack matching ---------------------------------------------------------
  const matcher = buildKeywordMatcher(["error", "failed"])!;
  assert(matcher.test("Deploy FAILED on prod"), "case-insensitive match");
  assert(matcher.test("500 error on /checkout"), "word match");
  assert(!matcher.test("errorless run"), "no match inside a longer word");
  assert(buildKeywordMatcher([]) === null, "no keywords → no matcher");
  assert(plainSlackText("<https://x.io|Build 42> failed for <@U123>") === "Build 42 failed for @U123", "Slack markup stripped");
  console.log("4) Slack keyword matching ✓");

  // 5. Crypto -----------------------------------------------------------------
  const secret = "1//refresh-token-example";
  const enc = encryptSecret(secret);
  assert(enc !== secret && enc.startsWith("v1."), "encrypted format");
  assert(decryptSecret(enc) === secret, "round trip");
  const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
  let rejected = false;
  try {
    decryptSecret(tampered);
  } catch {
    rejected = true;
  }
  assert(rejected, "tampered ciphertext must be rejected");
  assert(safeEqual(hashToken("a"), hashToken("a")) && !safeEqual(hashToken("a"), hashToken("b")), "safeEqual");
  console.log("5) Secret encryption and token comparison ✓");

  // 6. Website classification (local server) ----------------------------------
  const { checkWebsite } = await import("../lib/services/companion/integrations/websites");

  const blocked = await checkWebsite("http://127.0.0.1:9/");
  assert(blocked.health === "down" && blocked.error?.includes("Private"), "private URL refused when not allowed");

  process.env.COMPANION_ALLOW_PRIVATE_URLS = "true";
  const server: Server = createServer((req, res) => {
    if (req.url === "/ok") return res.end("ok");
    if (req.url === "/slow") return void setTimeout(() => res.end("slow"), 3500);
    if (req.url === "/hang") return; // never answers
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: "/ok" });
      return res.end();
    }
    if (req.url === "/404") {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(503);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const url = (path: string) => `http://127.0.0.1:${port}${path}`;

  const [ok, slow, notFound, broken, redirect, refused] = await Promise.all([
    checkWebsite(url("/ok")),
    checkWebsite(url("/slow")),
    checkWebsite(url("/404")),
    checkWebsite(url("/503")),
    checkWebsite(url("/redirect")),
    checkWebsite("http://127.0.0.1:1/"),
  ]);
  assert(ok.health === "up", `ok → up, got ${ok.health}`);
  assert(slow.health === "slow", `slow → slow, got ${slow.health} (${slow.ms} ms)`);
  assert(notFound.health === "client_error" && notFound.status === 404, "404 → client error");
  assert(broken.health === "down" && broken.status === 503, "503 → down");
  assert(redirect.health === "up" && redirect.status === 200, "redirect followed");
  assert(refused.health === "down", "connection refused → down");

  const started = Date.now();
  const hang = await checkWebsite(url("/hang"));
  const waited = Date.now() - started;
  assert(hang.health === "down" && hang.error === "No response in 8 s", `hang → timeout, got ${hang.error}`);
  assert(waited >= 7900 && waited < 9500, `timeout should be ~8 s, was ${waited} ms`);
  server.closeAllConnections();
  server.close();
  console.log("6) Website classification (up / slow / 4xx / 5xx / redirect / refused / 8 s timeout) ✓");

  console.log("\nAll companion checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
