// Offline checks for the desktop timer's journal and sync logic (no Electron, no network).
//   npm run build && node scripts/test-timer.mjs
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import Module, { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(os.tmpdir(), "priinteve-timer-"));

// log.ts imports electron's `app`; give it a stand-in so the compiled modules load under Node.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") return { app: { getPath: () => dir, isPackaged: true } };
  return originalLoad.call(this, request, parent, isMain);
};

const require = createRequire(import.meta.url);
const { TimerJournal } = require("../dist/main/journal.js");
const { TimerController } = require("../dist/main/timer.js");
const { workedSeconds } = require("../dist/shared/timer.js");

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

// ---------------------------------------------------------------- fake server

function fakeServer() {
  const s = {
    online: true,
    dropNextResponse: false,
    ledger: new Map(),
    session: null,
    entries: [],
    heartbeat: null,
    now: () => Date.now(),
    apply(op) {
      if (s.ledger.has(op.opId)) return s.ledger.get(op.opId);
      const at = Date.parse(op.occurredAt);
      let result = { opId: op.opId, status: "APPLIED", message: "ok" };
      if (op.type === "START") {
        if (s.session) s.closeSegment(at, "SWITCH", true);
        const id = `e${s.entries.length + 1}`;
        s.session = { sessionId: id, entryId: id, projectId: op.projectId, taskId: op.taskId ?? null, segStart: at, closed: 0, start: at, status: "RUNNING" };
      } else if (op.type === "PAUSE") {
        if (s.session?.status === "RUNNING") s.closeSegment(at, null, false);
      } else if (op.type === "RESUME") {
        if (s.session?.status === "PAUSED") {
          s.session.status = "RUNNING";
          s.session.segStart = at;
          s.session.entryId = `e${s.entries.length + 1}`;
        } else result = { opId: op.opId, status: "REJECTED", message: "Nothing paused" };
      } else if (op.type === "STOP") {
        if (s.session?.status === "RUNNING") s.closeSegment(at, op.stopReason, true);
        else if (s.session) s.session = null;
      }
      s.ledger.set(op.opId, result);
      return result;
    },
    closeSegment(at, reason, end) {
      const seconds = Math.floor((at - s.session.segStart) / 1000);
      s.entries.push({ id: s.session.entryId, sessionId: s.session.sessionId, seconds, reason });
      s.session.closed += seconds;
      s.session.status = "PAUSED";
      if (end) s.session = null;
    },
    state() {
      const x = s.session;
      return {
        serverTime: new Date(s.now()).toISOString(),
        canCreateTasks: true,
        projects: [{ id: "p1", name: "Website", code: "WEB", tasks: [{ id: "t1", title: "Homepage", status: "TODO" }] }],
        session: x && {
          entryId: x.entryId,
          sessionId: x.sessionId,
          status: x.status,
          projectId: x.projectId,
          projectName: "Website",
          projectCode: "WEB",
          taskId: x.taskId,
          taskTitle: "Homepage",
          taskDescription: "Homepage",
          sessionStartedAt: new Date(x.start).toISOString(),
          segmentStartedAt: new Date(x.segStart).toISOString(),
          pausedAt: null,
          closedSeconds: x.closed,
          lastHeartbeatAt: s.heartbeat,
        },
      };
    },
  };
  return {
    server: s,
    deps: {
      dataDir: dir,
      fetchState: async () => (s.online ? { ok: true, data: s.state() } : { ok: false, error: "offline" }),
      postOps: async (ops) => {
        if (!s.online) return { ok: false, error: "offline" };
        const results = ops.map((op) => s.apply(op));
        if (s.dropNextResponse) {
          s.dropNextResponse = false;
          return { ok: false, error: "offline" }; // applied, but the answer was lost
        }
        return { ok: true, data: { results, state: s.state() } };
      },
    },
  };
}

// ---------------------------------------------------------------- journal

await check("journal survives reload, acks and a torn last line", async () => {
  const file = path.join(dir, "j-test.jsonl");
  const j = new TimerJournal(file);
  for (const id of ["a1111111", "b2222222", "c3333333"]) j.append({ opId: id, type: "PAUSE", occurredAt: new Date().toISOString() });
  appendFileSync(file, '{"t":"op","op":{"opId":"torn'); // power cut mid-write
  const reloaded = new TimerJournal(file);
  assert.deepEqual(reloaded.pending().map((o) => o.opId), ["a1111111", "b2222222", "c3333333"]);
  reloaded.ack(["a1111111", "b2222222"]);
  assert.deepEqual(new TimerJournal(file).pending().map((o) => o.opId), ["c3333333"]);
  new TimerJournal(file).ack(["c3333333"]);
  assert.equal(readFileSync(file, "utf8"), "", "compacted once nothing is pending");
});

// ---------------------------------------------------------------- controller

const { server, deps } = fakeServer();

await check("first sync loads projects", async () => {
  const t = new TimerController(deps);
  await t.flush();
  assert.equal(t.view().projects.length, 1);
  assert.equal(t.view().sync, "synced");
});

await check("offline start is journaled, shown as running, and survives a restart", async () => {
  server.online = false;
  const t = new TimerController(deps);
  const res = await t.act({ type: "START", projectId: "p1", taskId: "t1" });
  assert.equal(res.ok, true);
  assert.match(res.message, /Saved on this PC/);
  assert.equal(t.view().status, "RUNNING");
  assert.equal(t.view().unconfirmed, true);
  assert.equal(t.isActive(), true);
  const restarted = new TimerController(deps);
  assert.equal(restarted.view().status, "RUNNING", "pending start replayed after restart");
  assert.equal(restarted.view().pendingOps, 1);
});

await check("a lost response is retried without creating a second session", async () => {
  server.online = true;
  server.dropNextResponse = true;
  const t = new TimerController(deps);
  await t.flush(); // applied on the server, answer lost
  assert.equal(t.view().pendingOps, 1);
  await t.flush(); // same opId again: the ledger returns the first result
  assert.equal(t.view().pendingOps, 0);
  assert.equal(server.ledger.size, 1);
  assert.equal(t.view().status, "RUNNING");
  assert.equal(t.view().unconfirmed, false);
});

await check("paused time is not counted", async () => {
  const t = new TimerController(deps);
  await t.flush();
  server.session.segStart -= 10_000; // pretend 10 s of work
  server.session.start -= 10_000;
  await t.flush();
  server.online = false;
  await t.act({ type: "PAUSE" });
  const pausedAt = workedSeconds(t.view(), t.serverNow());
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(workedSeconds(t.view(), t.serverNow()), pausedAt, "clock frozen while paused");
  assert.ok(pausedAt >= 10 && pausedAt <= 11, `worked ${pausedAt}s`);
  await t.act({ type: "RESUME" });
  server.online = true;
  await t.flush();
  assert.equal(t.view().status, "RUNNING");
  assert.ok(server.session.closed >= 10, "server kept the first segment");
});

await check("stop while offline, restart, then sync: one stop, nothing left open", async () => {
  server.online = false;
  const t = new TimerController(deps);
  await t.act({ type: "STOP", stopReason: "SHUTDOWN" });
  assert.equal(t.view().status, "IDLE");
  assert.equal(t.isActive(), false, "shutdown no longer blocked once the stop is on disk");
  const restarted = new TimerController(deps);
  assert.equal(restarted.view().status, "IDLE");
  server.online = true;
  assert.equal(await restarted.flushWithin(2000), true);
  assert.equal(server.session, null);
  assert.equal(server.entries.at(-1).reason, "SHUTDOWN");
});

await check("refused actions don't change anything when nothing is running", async () => {
  const t = new TimerController(deps);
  await t.flush();
  const res = await t.act({ type: "STOP" });
  assert.equal(res.ok, false);
  assert.equal(t.view().pendingOps, 0);
});

await check("an interrupted session is reported once, and not again after a choice", async () => {
  const t = new TimerController(deps);
  await t.act({ type: "START", projectId: "p1", taskId: "t1" });
  server.heartbeat = new Date(Date.now() - 10 * 60_000).toISOString();
  let seen = 0;
  t.onInterruption(() => (seen += 1));
  await t.flush();
  await t.flush();
  assert.equal(seen, 1);
  const i = t.currentInterruption();
  assert.ok(i);
  t.dismissInterruption(i.key);
  const restarted = new TimerController(deps);
  let again = 0;
  restarted.onInterruption(() => (again += 1));
  await restarted.flush();
  assert.equal(again, 0, "dismissed gap is remembered across restarts");
  await restarted.act({ type: "STOP" });
});

rmSync(dir, { recursive: true, force: true });
console.log(`\nAll ${passed} desktop timer checks passed.`);
