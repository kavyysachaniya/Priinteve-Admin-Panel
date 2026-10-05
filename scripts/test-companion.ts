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
  const { isNewerVersion, versionFromInstallerName, compareVersions } = await import("../lib/services/companion/versions");
  const { taskDueInstant } = await import("../lib/services/notifications");
  const { isWithinWorkHours, msUntilNextTick, parseUpdateInfo, parseReminder, parseLive, parseBriefing } = await import("../companion/src/shared/briefing");
  const { taskRowState } = await import("../lib/services/companion/task-rows");
  const { parseLiveIds } = await import("../lib/services/companion/live");

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

  // 5b. Auto-update versions, due times, work hours, reminder ticks ----------------
  assert(versionFromInstallerName("Priinteve-Companion-Setup-0.0.2.exe") === "0.0.2", "version from installer name");
  assert(versionFromInstallerName("Priinteve-Companion-Setup-latest.exe") === null, "reject an unversioned name");
  assert(versionFromInstallerName("Setup 1.2.3.exe") === null, "reject a foreign file name");
  assert(isNewerVersion("0.0.2", "0.0.1"), "0.0.2 is newer than 0.0.1");
  assert(isNewerVersion("0.1.0", "0.0.9"), "minor beats patch");
  assert(isNewerVersion("1.0.0", "0.9.9"), "major beats minor");
  assert(!isNewerVersion("0.0.1", "0.0.1"), "same version is not an update");
  assert(!isNewerVersion("0.0.1", "0.1.0"), "never offer a downgrade");
  assert(!isNewerVersion("garbage", "0.0.1"), "malformed version is ignored");
  assert(compareVersions("0.0.10", "0.0.9")! > 0, "compare numerically, not as text");

  // 10:30 IST on 5 Oct 2026 is 05:00 UTC.
  assert(taskDueInstant(new Date("2026-10-05"), "10:30")?.toISOString() === "2026-10-05T05:00:00.000Z", "task due instant in IST");
  assert(taskDueInstant(new Date("2026-10-05"), null) === null, "no time means no instant");
  assert(taskDueInstant(new Date("2026-10-05"), "25:99") === null || taskDueInstant(new Date("2026-10-05"), "xx") === null, "bad time ignored");

  const hours = { start: "10:00", end: "19:00", days: [1, 2, 3, 4, 5, 6] };
  const at = (iso: string) => new Date(iso); // local time, no zone suffix
  assert(isWithinWorkHours(at("2026-10-05T11:00:00"), hours), "Monday 11:00 is inside");
  assert(!isWithinWorkHours(at("2026-10-05T09:59:00"), hours), "before the start is outside");
  assert(isWithinWorkHours(at("2026-10-05T18:59:00"), hours), "just before the end is inside");
  assert(!isWithinWorkHours(at("2026-10-05T19:00:00"), hours), "the end time is exclusive");
  assert(!isWithinWorkHours(at("2026-10-04T12:00:00"), hours), "Sunday is not a work day");

  assert(msUntilNextTick(at("2026-10-05T10:07:30")) === 22.5 * 60_000, "next tick from 10:07:30 is 22.5 min away");
  assert(msUntilNextTick(at("2026-10-05T10:30:00")) === 30 * 60_000, "exactly :30 waits for :00");
  assert(msUntilNextTick(at("2026-10-05T10:59:59")) === 1000, "never less than a second");

  const sha = "a".repeat(64);
  assert(parseUpdateInfo({ updateAvailable: true, version: "0.0.2", sha256: sha, url: "https://x.s3.amazonaws.com/a.exe" })?.version === "0.0.2", "valid update accepted");
  assert(parseUpdateInfo({ updateAvailable: true, version: "0.0.2", sha256: sha, url: "http://evil.example/a.exe" }) === null, "plain http download refused");
  assert(parseUpdateInfo({ updateAvailable: true, version: "0.0.2", sha256: "zz", url: "https://x/a.exe" }) === null, "bad checksum refused");
  assert(parseUpdateInfo({ updateAvailable: false }) === null, "no update");
  assert(parseReminder({ enabled: true, start: "bad", end: "19:00", days: [1, 9], quiet: false, briefing: null })?.start === "10:00", "reminder falls back on bad times");
  assert(parseReminder({ enabled: "yes" }) === null, "reminder payload must be well formed");
  console.log("5b) Versions, due times, work hours, reminder ticks, update payloads ✓");

  // 5c. Live task rows ----------------------------------------------------------------
  const withProject = { id: "t1", project: { id: "p" } };
  const running = taskRowState(withProject, "t1");
  assert(running.running === true && running.actions.join() === "complete,stop-timer", "running task offers Stop, not Start");
  const idle = taskRowState({ id: "t2", project: { id: "p" } }, "t1");
  assert(idle.running === undefined && idle.actions.join() === "complete,start-timer", "other tasks offer Start");
  assert(taskRowState({ id: "t3", project: null }, null).actions.join() === "complete", "no project, no timer button");

  assert(parseLiveIds(null)!.length === 0 && parseLiveIds("")!.length === 0, "no ids is fine");
  assert(parseLiveIds("a1,b2,a1")!.join() === "a1,b2", "ids are de-duplicated");
  assert(parseLiveIds("bad id") === null && parseLiveIds("a;b") === null, "malformed ids are refused");
  assert(parseLiveIds(Array.from({ length: 41 }, (_, i) => "t" + i).join(",")) === null, "more than 40 ids refused");
  assert(parseLiveIds(Array.from({ length: 40 }, (_, i) => "t" + i).join(","))!.length === 40, "40 ids allowed");

  const live = parseLive({
    timer: { taskId: "t1", projectName: "Saloonly", startedAt: "2026-10-05T07:00:00.000Z" },
    tasks: { t1: "IN_PROGRESS", t2: "COMPLETED", "bad id": "TODO", t3: "WHATEVER" },
  })!;
  assert(live.timer?.taskId === "t1" && live.tasks.t2 === "COMPLETED", "live payload parsed");
  assert(!("bad id" in live.tasks) && !("t3" in live.tasks), "invalid ids and statuses dropped");
  assert(parseLive({ timer: { startedAt: "nope" }, tasks: {} })!.timer === null, "timer without a valid start is ignored");
  assert(parseLive({}) === null, "payload without tasks refused");

  const parsed = parseBriefing({
    sections: [{ key: "k", title: "T", status: "todo", items: [{ label: "x", status: "ok", running: true, taskId: "abc", actions: ["complete", "bogus", "stop-timer"] }] }],
  })!;
  const item = parsed.sections[0].items[0];
  assert(item.running === true && item.taskId === "abc" && item.actions?.join() === "complete,stop-timer", "briefing keeps running/taskId and drops unknown actions");
  console.log("5c) Live task rows, live ids, live payload ✓");

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
