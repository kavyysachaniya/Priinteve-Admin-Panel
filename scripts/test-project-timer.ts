import { prisma } from "../lib/prisma";
import * as projectService from "../lib/services/projects";
import * as customerService from "../lib/services/customers";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== Testing Projects & Timer Module ===");

  // 1. Ensure a test user exists
  let user = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Admin Tester",
        email: `tester-${Date.now()}@priinteve.com`,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }
  console.log("1) Test User:", user.name, `(${user.id})`);

  // 2. Create a test customer
  const customer = await customerService.createCustomer({
    type: "BUSINESS",
    name: "Acme Corp Design Client",
    phone: "9123456780",
    email: "client@acme.example",
    status: "ACTIVE",
  });
  console.log("2) Created Customer:", customer.name, `(${customer.id})`);

  // 3. Create Project
  console.log("3) Creating Project 'Brand Identity Redesign'…");
  const project = await projectService.createProject(
    {
      name: "Brand Identity Redesign",
      description: "Full logo overhaul, stationery kit, and digital assets.",
      status: "NOT_STARTED",
      priority: "HIGH",
      customerId: customer.id,
      assignedToId: user.id,
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      notes: "High priority client deadline.",
    },
    user.id
  );
  assert(project.id, "Project ID must exist");
  assert(project.status === "NOT_STARTED", "Project initial status must be NOT_STARTED");
  console.log("   OK: Project created:", project.id, project.name);

  // 4. Start Timer
  console.log("4) Starting timer on project…");
  const entry1 = await projectService.startProjectTimer(project.id, user.id, "Initial kickoff session");
  assert(entry1.status === "RUNNING", "Entry status should be RUNNING");
  console.log("   OK: Timer started at:", entry1.startedAt);

  // Verify Project status transitioned to IN_PROGRESS
  const projectAfterStart = await projectService.getProjectById(project.id);
  assert(projectAfterStart?.status === "IN_PROGRESS", "Project status should transition to IN_PROGRESS");
  assert(projectAfterStart?.timerStatus === "RUNNING", "Project timerStatus should be RUNNING");
  console.log("   OK: Project status automatically updated to IN_PROGRESS");

  // 5. Test Duplicate Active Timer Protection on Same Project
  console.log("5) Testing duplicate active timer protection on same project…");
  let duplicateError = false;
  try {
    await projectService.startProjectTimer(project.id, user.id);
  } catch (err: any) {
    duplicateError = true;
    console.log("   OK: Duplicate timer prevented with error:", err.message);
  }
  assert(duplicateError, "Duplicate timer start on same project must be rejected");

  // 6. Test Multi-Project User Active Timer Protection
  console.log("6) Creating second project & testing user concurrency protection…");
  const project2 = await projectService.createProject(
    {
      name: "Product Packaging Design",
      description: "Packaging design for 5 SKUs",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      customerId: customer.id,
      assignedToId: "",
      startDate: "",
      dueDate: "",
      notes: ""
    },
    user.id
  );

  let userConcurrencyError = false;
  try {
    await projectService.startProjectTimer(project2.id, user.id);
  } catch (err: any) {
    userConcurrencyError = true;
    console.log("   OK: User concurrency protected with error:", err.message);
  }
  assert(userConcurrencyError, "User should not be able to run multiple simultaneous project timers");

  // 6b. Test Timer Ownership Protection: a different user must not be able to pause/stop this timer
  console.log("6b) Testing timer ownership protection against a second user…");
  const otherUser = await prisma.user.create({
    data: {
      name: "Other Tester",
      email: `other-tester-${Date.now()}@priinteve.com`,
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
  });

  let ownershipErrorOnPause = false;
  try {
    await projectService.pauseProjectTimer(project.id, otherUser.id);
  } catch (err: unknown) {
    ownershipErrorOnPause = true;
    console.log("   OK: Other user blocked from pausing:", err instanceof Error ? err.message : err);
  }
  assert(ownershipErrorOnPause, "A different user must not be able to pause someone else's running timer");

  let ownershipErrorOnStop = false;
  try {
    await projectService.stopProjectTimer(project.id, otherUser.id);
  } catch (err: unknown) {
    ownershipErrorOnStop = true;
    console.log("   OK: Other user blocked from stopping:", err instanceof Error ? err.message : err);
  }
  assert(ownershipErrorOnStop, "A different user must not be able to stop someone else's running timer");

  const projectStillRunning = await projectService.getProjectById(project.id);
  assert(projectStillRunning?.timerStatus === "RUNNING", "Timer must still be running after blocked attempts");
  await prisma.user.delete({ where: { id: otherUser.id } });

  // 7. Wait 2 seconds and Pause Timer
  console.log("7) Simulating work and pausing timer…");
  await sleep(2000);
  const pausedEntry = await projectService.pauseProjectTimer(project.id, user.id);
  assert(pausedEntry.status === "PAUSED", "Entry status must be PAUSED");
  assert(pausedEntry.durationSeconds >= 2, "Duration should be at least 2 seconds");
  console.log("   OK: Timer paused, recorded duration:", pausedEntry.durationSeconds, "seconds");

  // 8. Resume Timer
  console.log("8) Resuming timer…");
  const resumedEntry = await projectService.resumeProjectTimer(project.id, user.id);
  assert(resumedEntry.status === "RUNNING", "Resumed entry status must be RUNNING");
  console.log("   OK: Timer resumed at:", resumedEntry.startedAt);

  // 9. Wait 2 seconds and Stop Timer
  console.log("9) Simulating work and stopping timer…");
  await sleep(2000);
  await projectService.stopProjectTimer(project.id, user.id);

  const projectAfterStop = await projectService.getProjectById(project.id);
  assert(projectAfterStop?.timerStatus === "IDLE", "Timer status should be IDLE after stop");
  assert(projectAfterStop?.timeEntries.length === 2, "Should have 2 recorded time entries");
  assert(projectAfterStop?.totalDurationSeconds >= 4, "Total duration should sum all sessions (>= 4s)");
  console.log("   OK: Timer stopped, Total Tracked Time:", projectAfterStop.totalDurationSeconds, "seconds across", projectAfterStop.timeEntries.length, "sessions");

  // 9a. Sessions: the paused and resumed segments share one session
  const segments = await prisma.projectTimeEntry.findMany({ where: { projectId: project.id }, orderBy: { startedAt: "asc" } });
  assert(segments.length === 2 && segments[0].sessionId === segments[1].sessionId, "Pause/resume segments must share a sessionId");
  assert(segments.every((s) => s.status === "COMPLETED"), "All segments must be COMPLETED after stop");
  console.log("   OK: Both segments belong to session", segments[0].sessionId);

  // 9b–9h run as throwaway employees so a real admin's timer is never touched.
  const stamp = Date.now();
  const emp = await prisma.user.create({
    data: { name: "Timer Emp A", email: `timer-a-${stamp}@priinteve.test`, role: "EMPLOYEE", status: "ACTIVE" },
  });
  const emp2 = await prisma.user.create({
    data: { name: "Timer Emp B", email: `timer-b-${stamp}@priinteve.test`, role: "EMPLOYEE", status: "ACTIVE" },
  });
  const outsider = await prisma.user.create({
    data: { name: "Timer Outsider", email: `timer-c-${stamp}@priinteve.test`, role: "EMPLOYEE", status: "ACTIVE" },
  });
  await prisma.projectAssignment.createMany({
    data: [project.id, project2.id].flatMap((projectId) =>
      [emp.id, emp2.id].map((employeeId) => ({ projectId, employeeId, assignedById: user.id }))
    ),
  });

  try {
    console.log("9b) Concurrent double start creates one running segment…");
    const results = await Promise.allSettled([
      projectService.startProjectTimer(project2.id, emp.id, "Double click A", null, { autoStopPrevious: true }),
      projectService.startProjectTimer(project2.id, emp.id, "Double click B", null, { autoStopPrevious: true }),
    ]);
    const running = await prisma.projectTimeEntry.count({ where: { userId: emp.id, endedAt: null } });
    assert(running === 1, `Expected exactly 1 open segment after a double start, found ${running}`);
    console.log("   OK:", results.map((r) => r.status).join(" / "), "→ 1 running segment");

    console.log("9c) Idempotent pause, and resume ownership…");
    const p1 = await projectService.pauseProjectTimer(project2.id, emp.id);
    const p2 = await projectService.pauseProjectTimer(project2.id, emp.id);
    assert(p1.id === p2.id && p2.status === "PAUSED", "Pausing twice must return the same paused segment");
    let blocked = false;
    try {
      await projectService.resumeProjectTimer(project2.id, emp2.id);
    } catch {
      blocked = true;
    }
    assert(blocked, "Another employee must not resume someone else's paused timer");
    blocked = false;
    try {
      await projectService.resumeProjectTimer(project2.id, outsider.id);
    } catch (err) {
      blocked = err instanceof Error && err.message.includes("assigned");
    }
    assert(blocked, "An unassigned employee must not resume on the project");
    console.log("   OK: Only the owner can resume");

    console.log("9d) Another user's stop leaves this user's paused session alone…");
    await projectService.stopProjectTimer(project2.id, emp2.id);
    const stillPaused = await prisma.projectTimeEntry.findUnique({ where: { id: p1.id } });
    assert(stillPaused?.status === "PAUSED", "emp's paused segment must stay PAUSED");
    console.log("   OK");

    console.log("9e) Resume replay is idempotent and keeps the session…");
    const r1 = await projectService.resumeProjectTimer(project2.id, emp.id, { clientOpId: `op-r-${stamp}` });
    const r2 = await projectService.resumeProjectTimer(project2.id, emp.id, { clientOpId: `op-r-${stamp}` });
    assert(r1.id === r2.id, "Replaying a resume op must not create a second segment");
    assert(r1.sessionId === (p1.sessionId ?? p1.id), "Resumed segment must keep the session id");
    console.log("   OK");

    console.log("9f) Switching projects stops the first session (reason SWITCH)…");
    const switched = await projectService.startProjectTimer(project.id, emp.id, "Switched work", null, {
      autoStopPrevious: true,
      clientOpId: `op-s-${stamp}`,
    });
    const old = await prisma.projectTimeEntry.findUnique({ where: { id: r1.id } });
    assert(old?.status === "COMPLETED" && old.stopReason === "SWITCH", "Previous segment must be COMPLETED with SWITCH");
    assert(old.endedAt!.getTime() <= switched.startedAt.getTime(), "New session must start after the old one ended");
    const replay = await projectService.startProjectTimer(project.id, emp.id, "Switched work", null, {
      autoStopPrevious: true,
      clientOpId: `op-s-${stamp}`,
    });
    assert(replay.id === switched.id, "Replaying a start op must return the same segment");
    console.log("   OK");

    console.log("9g) An offline stop uses the recorded time, clamped to the segment…");
    const stopAt = new Date(switched.startedAt.getTime() + 1000);
    await sleep(1500);
    await projectService.stopProjectTimer(project.id, emp.id, undefined, { at: stopAt, stopReason: "SHUTDOWN" });
    const stopped = await prisma.projectTimeEntry.findUnique({ where: { id: switched.id } });
    assert(stopped?.endedAt?.getTime() === stopAt.getTime(), "endedAt must equal the offline stop time");
    assert(stopped.durationSeconds === 1 && stopped.stopReason === "SHUTDOWN", "Duration from timestamps, reason kept");
    const again = await projectService.stopProjectTimer(project.id, emp.id);
    assert(again.success && again.entryId === null, "Stopping twice is a harmless no-op");
    console.log("   OK");

    console.log("9h) Corrections are audited…");
    const empUser = { id: emp.id, role: "EMPLOYEE", name: emp.name, email: emp.email } as never;
    const edited = await projectService.updateTimeEntry(
      switched.id,
      { endedAt: new Date(switched.startedAt.getTime() + 600_000 > Date.now() ? Date.now() : switched.startedAt.getTime() + 600_000).toISOString(), reason: "Forgot to stop" },
      empUser
    );
    let nullEnd = false;
    try {
      await projectService.updateTimeEntry(switched.id, { endedAt: "not-a-date", reason: "bad" }, empUser);
    } catch {
      nullEnd = true;
    }
    assert(nullEnd, "Invalid end time must be rejected");
    await projectService.deleteTimeEntry(edited.id, empUser, "Duplicate entry");
    const audit = await prisma.timeEntryCorrection.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } });
    assert(audit.length === 2 && audit[0].action === "EDIT" && audit[1].action === "DELETE", "Expected EDIT then DELETE audit rows");
    assert(audit[1].entryId === null && (audit[1].before as { durationSeconds: number }).durationSeconds === edited.durationSeconds, "Delete keeps a snapshot");
    console.log("   OK: audit rows", audit.map((a) => a.action).join(", "));
  } finally {
    await prisma.projectTimeEntry.deleteMany({ where: { userId: { in: [emp.id, emp2.id, outsider.id] } } });
    await prisma.timeEntryCorrection.deleteMany({ where: { projectId: { in: [project.id, project2.id] } } });
    await prisma.projectAssignment.deleteMany({ where: { employeeId: { in: [emp.id, emp2.id, outsider.id] } } });
    await prisma.activityLog.deleteMany({ where: { userId: { in: [emp.id, emp2.id, outsider.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [emp.id, emp2.id, outsider.id] } } });
  }

  // 10. Test Project Stats
  console.log("10) Verifying project statistics aggregation…");
  const stats = await projectService.getProjectStats();
  assert(stats.totalProjects >= 2, "Total projects count should be at least 2");
  assert(stats.totalTrackedSeconds >= projectAfterStop.totalDurationSeconds, "Total tracked seconds must be >= project duration");
  console.log("    OK: Stats:", JSON.stringify(stats));

  // 11. Cleanup Test Entities
  console.log("11) Cleaning up test projects…");
  await projectService.deleteProject(project.id, user.id);
  await projectService.deleteProject(project2.id, user.id);
  await prisma.customer.delete({ where: { id: customer.id } });
  console.log("    OK: Cleaned up test data.");

  console.log("\n ALL PROJECTS & PROJECT TIMER MODULE TESTS PASSED SUCCESSFULLY! \n");
}

main()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
