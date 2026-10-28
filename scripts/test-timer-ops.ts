/**
 * Desktop timer ops (POST /api/companion/timer/ops service): idempotent replays, offline
 * timestamps, conflicts, switching, recovery with an audit row, and that one user's ops can't
 * touch another's. Writes to the database in .env and removes everything it created.
 *
 *   npx tsx scripts/test-timer-ops.ts
 */
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import * as projectService from "../lib/services/projects";
import { applyCompanionTimerOps, getCompanionTimerState } from "../lib/services/companion/timer";
import type { SessionUser } from "../lib/auth/session";
import type { CompanionTimerOp } from "../lib/validations/companion-timer";

type OpInput = CompanionTimerOp extends infer T ? (T extends CompanionTimerOp ? Omit<T, "opId" | "occurredAt"> & { at?: Date } : never) : never;
const op = (o: OpInput): CompanionTimerOp =>
  ({ ...o, opId: randomUUID(), occurredAt: (o.at ?? new Date()).toISOString() }) as CompanionTimerOp;

async function run() {
  console.log("=== Testing desktop timer ops ===");
  const ts = Date.now();
  const mk = async (id: string, role: "ADMIN" | "EMPLOYEE"): Promise<SessionUser> => {
    const email = `${id}@priinteve.test`;
    await prisma.user.create({ data: { id, name: id, email, role, status: "ACTIVE" } });
    return { id, name: id, email, role };
  };
  const admin = await mk(`ops-admin-${ts}`, "ADMIN");
  const emp = await mk(`ops-emp-${ts}`, "EMPLOYEE");
  const other = await mk(`ops-other-${ts}`, "EMPLOYEE");
  const userIds = [admin.id, emp.id, other.id];

  const mkProject = (name: string) =>
    projectService.createProject(
      { name, description: "Ops test", status: "IN_PROGRESS", priority: "MEDIUM", customerId: "", assignedToId: "", startDate: "", dueDate: "", notes: "", assignedEmployeeIds: [emp.id, other.id] },
      admin.id
    );
  const p1 = await mkProject(`Ops Website ${ts}`);
  const p2 = await mkProject(`Ops Print ${ts}`);
  const t1 = await prisma.task.create({ data: { title: "Homepage ✨ हिंदी", projectId: p1.id, assignedToId: emp.id } });

  try {
    console.log("1) Picker lists assigned projects and open tasks");
    const state = await getCompanionTimerState(emp);
    assert.ok(state.projects.some((p) => p.id === p1.id && p.tasks.some((t) => t.id === t1.id)));
    assert.strictEqual(state.session, null);

    console.log("2) Live START applies once; replaying the same op is a no-op");
    const start = op({ type: "START", projectId: p1.id, taskId: t1.id });
    const r1 = await applyCompanionTimerOps(emp, [start]);
    const r2 = await applyCompanionTimerOps(emp, [start]);
    assert.strictEqual(r1.results[0].status, "APPLIED");
    assert.deepStrictEqual(r2.results[0], r1.results[0]);
    assert.strictEqual(await prisma.projectTimeEntry.count({ where: { userId: emp.id } }), 1);
    assert.strictEqual(r1.state.session?.status, "RUNNING");
    assert.strictEqual(r1.state.session?.taskId, t1.id);

    console.log("3) Another user can't replay someone else's op id");
    const stolen = await applyCompanionTimerOps(other, [start]);
    assert.strictEqual(stolen.results[0].status, "REJECTED");
    assert.strictEqual(await prisma.projectTimeEntry.count({ where: { userId: other.id } }), 0);

    console.log("4) Offline PAUSE/RESUME/STOP batch keeps its recorded times and excludes paused time");
    const running = await prisma.projectTimeEntry.findFirstOrThrow({ where: { userId: emp.id, status: "RUNNING" } });
    // Pretend the segment began 10 minutes ago, then the PC went offline.
    const base = new Date(Date.now() - 10 * 60_000);
    await prisma.projectTimeEntry.update({ where: { id: running.id }, data: { startedAt: base } });
    const batch = await applyCompanionTimerOps(emp, [
      op({ type: "PAUSE", at: new Date(base.getTime() + 2 * 60_000) }),
      op({ type: "RESUME", projectId: p1.id, at: new Date(base.getTime() + 5 * 60_000) }),
      op({ type: "STOP", stopReason: "SHUTDOWN", at: new Date(base.getTime() + 8 * 60_000) }),
    ]);
    assert.deepStrictEqual(batch.results.map((r) => r.status), ["APPLIED", "APPLIED", "APPLIED"]);
    const segs = await prisma.projectTimeEntry.findMany({ where: { userId: emp.id }, orderBy: { startedAt: "asc" } });
    assert.strictEqual(segs.length, 2);
    assert.ok(segs.every((s) => s.status === "COMPLETED" && s.sessionId === segs[0].sessionId));
    assert.deepStrictEqual(segs.map((s) => s.durationSeconds), [120, 180], "2 min + 3 min, 3 min pause excluded");
    assert.strictEqual(segs[1].stopReason, "SHUTDOWN");
    assert.strictEqual(segs[1].source, "DESKTOP_OFFLINE");
    assert.strictEqual(batch.state.session, null);

    console.log("5) A late offline START older than a newer running timer is a conflict");
    await applyCompanionTimerOps(emp, [op({ type: "START", projectId: p2.id, newTaskTitle: "Brochure proof" })]);
    const late = await applyCompanionTimerOps(emp, [op({ type: "START", projectId: p1.id, taskId: t1.id, at: new Date(Date.now() - 60 * 60_000) })]);
    assert.strictEqual(late.results[0].status, "CONFLICT");
    assert.strictEqual(late.state.session?.projectId, p2.id, "the newer timer keeps running");
    const created = await prisma.task.findFirst({ where: { projectId: p2.id, title: "Brochure proof" } });
    assert.ok(created && created.assignedToId === emp.id, "new task created and assigned to the tracker");

    console.log("6) Switching tasks stops the first session before starting the second");
    const sw = await applyCompanionTimerOps(emp, [op({ type: "START", projectId: p1.id, taskId: t1.id })]);
    assert.strictEqual(sw.results[0].status, "APPLIED");
    const prev = await prisma.projectTimeEntry.findFirstOrThrow({ where: { userId: emp.id, projectId: p2.id } });
    assert.strictEqual(prev.status, "COMPLETED");
    assert.strictEqual(prev.stopReason, "SWITCH");
    assert.strictEqual(await prisma.projectTimeEntry.count({ where: { userId: emp.id, endedAt: null } }), 1);

    console.log("7) A STOP for an older session leaves the current one running");
    const stale = await applyCompanionTimerOps(emp, [op({ type: "STOP", sessionId: prev.sessionId! })]);
    assert.strictEqual(stale.results[0].status, "APPLIED");
    assert.strictEqual(stale.state.session?.status, "RUNNING");

    console.log("8) Recovery stop closes at the last heartbeat, flags it and writes an audit row");
    const live = await prisma.projectTimeEntry.findFirstOrThrow({ where: { userId: emp.id, status: "RUNNING" } });
    const heartbeat = new Date(Date.now() - 30 * 60_000);
    await prisma.projectTimeEntry.update({
      where: { id: live.id },
      data: { startedAt: new Date(heartbeat.getTime() - 15 * 60_000), lastHeartbeatAt: heartbeat },
    });
    const seen = await getCompanionTimerState(emp);
    assert.strictEqual(seen.session?.lastHeartbeatAt, heartbeat.toISOString(), "state returns the heartbeat from before this poll");
    const rec = await applyCompanionTimerOps(emp, [op({ type: "STOP", stopReason: "RECOVERY", at: heartbeat })]);
    assert.strictEqual(rec.results[0].status, "APPLIED");
    const closed = await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: live.id } });
    assert.strictEqual(closed.endedAt?.toISOString(), heartbeat.toISOString());
    assert.strictEqual(closed.durationSeconds, 15 * 60);
    assert.ok(closed.interrupted && closed.stopReason === "RECOVERY");
    const audit = await prisma.timeEntryCorrection.findFirst({ where: { entryId: live.id, action: "RECOVERY" } });
    assert.ok(audit && audit.changedById === emp.id);

    console.log("9) Stopping with nothing open is harmless");
    const none = await applyCompanionTimerOps(emp, [op({ type: "STOP" })]);
    assert.strictEqual(none.results[0].status, "APPLIED");

    console.log("10) An unassigned employee's START is rejected, not applied");
    const outsiderProject = await projectService.createProject(
      { name: `Ops Private ${ts}`, description: "x", status: "IN_PROGRESS", priority: "LOW", customerId: "", assignedToId: "", startDate: "", dueDate: "", notes: "" },
      admin.id
    );
    try {
      const rej = await applyCompanionTimerOps(other, [op({ type: "START", projectId: outsiderProject.id, newTaskTitle: "Sneaky" })]);
      assert.strictEqual(rej.results[0].status, "REJECTED");
      assert.strictEqual(await prisma.projectTimeEntry.count({ where: { userId: other.id } }), 0);
    } finally {
      await projectService.deleteProject(outsiderProject.id, admin.id);
    }

    console.log("\n ALL DESKTOP TIMER OPS TESTS PASSED \n");
  } finally {
    await prisma.timerOperation.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.timeEntryCorrection.deleteMany({ where: { projectId: { in: [p1.id, p2.id] } } });
    await prisma.projectTimeEntry.deleteMany({ where: { userId: { in: userIds } } });
    await projectService.deleteProject(p1.id, admin.id).catch(() => {});
    await projectService.deleteProject(p2.id, admin.id).catch(() => {});
    await prisma.activityLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

run()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
