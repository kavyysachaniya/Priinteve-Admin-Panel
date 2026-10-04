import assert from "node:assert";
import { prisma } from "../lib/prisma";
import * as projectService from "../lib/services/projects";
import * as taskService from "../lib/services/tasks";
import { toClientProjectDto } from "../lib/auth/projects";
import { ROLE_PERMISSIONS } from "../lib/auth/permissions";
import type { SessionUser } from "../lib/auth/session";
import type { TaskFormValues } from "../lib/validations/task";
import { taskFormDefaults } from "../lib/validations/task";

async function expectThrow(fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
  } catch (err) {
    console.log(`   OK: ${label}: ${(err as Error).message}`);
    return;
  }
  throw new Error(`Expected failure but succeeded: ${label}`);
}

async function run() {
  console.log("=== Testing Task Board, Assignees, Deadlines & Time Approval ===");
  const ts = Date.now();

  const customer = await prisma.customer.create({
    data: { type: "BUSINESS", name: `Board Corp ${ts}`, email: `board-${ts}@example.com`, phone: `92222${String(ts).slice(-5)}`, status: "ACTIVE" },
  });

  const mk = async (id: string, name: string, role: "ADMIN" | "EMPLOYEE" | "CLIENT", customerId?: string): Promise<SessionUser> => {
    const email = `${id}@priinteve.com`;
    await prisma.user.create({ data: { id, name, email, role, status: "ACTIVE", customerId: customerId ?? null } });
    return { id, name, email, role, customerId } as SessionUser;
  };
  const admin = await mk(`b-admin-${ts}`, "Board Admin", "ADMIN");
  const emp = await mk(`b-emp-${ts}`, "Board Employee", "EMPLOYEE");
  const outsider = await mk(`b-out-${ts}`, "Board Outsider", "EMPLOYEE");
  const client = await mk(`b-client-${ts}`, "Board Client", "CLIENT", customer.id);
  const userIds = [admin.id, emp.id, outsider.id, client.id];

  const project = await projectService.createProject(
    {
      name: `Board Project ${ts}`, description: "", status: "NOT_STARTED", priority: "MEDIUM",
      customerId: customer.id, assignedToId: "", startDate: "", dueDate: "", notes: "",
    },
    admin.id
  );
  await projectService.assignEmployeesToProject(project.id, [emp.id], admin);

  const base = (over: Partial<TaskFormValues>) => taskFormDefaults({ projectId: project.id, ...over });

  // 1. Assignable users
  console.log("1) Assignable users include admin, assigned employee and project client...");
  const assignable = (await taskService.listAssignableUsers(project.id)).map((u) => u.id);
  assert(assignable.includes(admin.id) && assignable.includes(emp.id) && assignable.includes(client.id), "admin, employee, client assignable");
  assert(!assignable.includes(outsider.id), "unassigned employee must not be assignable");
  console.log("   OK");

  // 2. Assign to admin / employee / client with deadline
  console.log("2) Assigning tasks to admin, employee and client with deadlines...");
  const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const tAdmin = await taskService.createTask(base({ title: "For admin", assigneeId: admin.id, dueDate: due, dueTime: "17:30" }), emp);
  const tEmp = await taskService.createTask(base({ title: "For employee", assigneeId: emp.id, dueDate: due }), admin);
  const tClient = await taskService.createTask(base({ title: "For client", assigneeId: client.id, dueDate: due }), admin);
  assert(tAdmin.assignedToId === admin.id && tEmp.assignedToId === emp.id && tClient.assignedToId === client.id, "assignees saved");
  assert(tAdmin.dueTime === "17:30" && tAdmin.dueDate?.toISOString().slice(0, 10) === due, "deadline saved");
  await expectThrow(() => taskService.createTask(base({ title: "bad", assigneeId: outsider.id }), admin), "unassigned employee cannot be assignee");
  console.log("   OK");

  // 3. Board ordering + move rules
  console.log("3) Board: drag between columns and reorder within a column...");
  const t1 = await taskService.createTask(base({ title: "T1" }), admin);
  const t2 = await taskService.createTask(base({ title: "T2" }), admin);
  const t3 = await taskService.createTask(base({ title: "T3" }), admin);
  await taskService.moveTask(t3.id, { status: "TODO", aboveId: t1.id, belowId: t2.id }, emp);
  const todo = (await taskService.listTasksForBoard({ projectId: project.id }, admin)).filter((t) => t.status === "TODO");
  const order = todo.filter((t) => [t1.id, t2.id, t3.id].includes(t.id)).map((t) => t.title);
  assert(order.join(",") === "T1,T3,T2", `expected T1,T3,T2 but got ${order.join(",")}`);
  const moved = await taskService.moveTask(t1.id, { status: "IN_PROGRESS" }, emp);
  assert(moved.status === "IN_PROGRESS", "status changes across columns");
  console.log("   OK: order T1,T3,T2 after reorder; cross-column move works");

  console.log("4) Board: move permissions...");
  await expectThrow(() => taskService.moveTask(t2.id, { status: "COMPLETED" }, outsider), "unassigned employee cannot move");
  await expectThrow(() => taskService.moveTask(t2.id, { status: "COMPLETED" }, client), "client cannot move team task");
  const clientOwn = await taskService.createTask(base({ title: "Client own" }), client);
  const clientMoved = await taskService.moveTask(clientOwn.id, { status: "IN_PROGRESS" }, client);
  assert(clientMoved.status === "IN_PROGRESS", "client can move own task");
  const clientBoard = await taskService.listTasksForBoard({}, client);
  assert(clientBoard.length > 0 && clientBoard.every((t) => t.projectId === project.id), "client board scoped to own project");
  assert(clientBoard.every((t) => !("email" in (t.assignedTo ?? {}))), "board exposes no emails");
  const outsiderBoard = await taskService.listTasksForBoard({}, outsider);
  assert(!outsiderBoard.some((t) => t.projectId === project.id && t.assignedToId !== outsider.id), "unassigned employee sees no project tasks");
  console.log("   OK");

  // 5. Time approval
  console.log("5) Time approval: client only sees approved time...");
  const started = await projectService.startProjectTimer(project.id, emp.id, "Board work", tEmp.id);
  assert(started.taskId === tEmp.id, "timer linked to task");
  await new Promise((r) => setTimeout(r, 1200));
  await projectService.stopProjectTimer(project.id, emp.id);
  const entry = await prisma.projectTimeEntry.findFirstOrThrow({ where: { projectId: project.id } });
  await prisma.projectTimeEntry.update({ where: { id: entry.id }, data: { durationSeconds: 600 } });

  assert((await projectService.listProjectTimeEntries(project.id, client)).length === 0, "client sees no unapproved entries");
  const beforeProject = await projectService.getProjectById(project.id, client);
  assert(beforeProject && beforeProject.timeEntries.length === 0 && beforeProject.totalDurationSeconds === 0, "client project hides unapproved time");
  assert(toClientProjectDto(beforeProject as never).totalDurationSeconds === 0, "client DTO total is 0 before approval");

  await expectThrow(() => projectService.approveTimeEntry(entry.id, emp), "employee cannot approve");
  await expectThrow(() => projectService.approveTimeEntry(entry.id, client), "client cannot approve");
  assert(ROLE_PERMISSIONS.ADMIN.includes("projects:approve_time"), "admin has approve permission");
  assert(!ROLE_PERMISSIONS.EMPLOYEE.includes("projects:approve_time") && !ROLE_PERMISSIONS.CLIENT.includes("projects:approve_time"), "employee/client lack approve permission");

  await projectService.approveTimeEntry(entry.id, admin);
  const visible = await projectService.listProjectTimeEntries(project.id, client);
  assert(visible.length === 1, "client sees approved entry");
  const afterProject = await projectService.getProjectById(project.id, client);
  assert(afterProject!.totalDurationSeconds === 600, "client total includes approved time");
  const dto = toClientProjectDto(afterProject as never);
  assert(dto.totalDurationSeconds === 600 && dto.recentTimeEntries.length === 1, "client DTO shows approved time");

  await projectService.updateTimeEntry(entry.id, { taskDescription: "Edited by admin" } as never, admin);
  const edited = await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: entry.id } });
  assert(edited.approvedAt === null, "editing an entry clears approval");

  await projectService.approveAllCompletedEntries(project.id, admin);
  assert((await projectService.listProjectTimeEntries(project.id, client)).length === 1, "bulk approve works");
  await projectService.unapproveTimeEntry(entry.id, admin);
  assert((await projectService.listProjectTimeEntries(project.id, client)).length === 0, "unapprove hides entry again");

  const runner = await projectService.startProjectTimer(project.id, emp.id, "Live work", tEmp.id);
  const liveClient = await projectService.getProjectById(project.id, client);
  const liveDto = toClientProjectDto(liveClient as never);
  assert(liveDto.isSomeoneWorking && liveDto.totalDurationSeconds === 0, "running timer shows as working but adds no client time");
  await expectThrow(() => projectService.approveTimeEntry(runner.id, admin), "cannot approve a running entry");
  await projectService.stopProjectTimer(project.id, emp.id);
  console.log("   OK");

  console.log("6) Cleaning up...");
  await prisma.projectTimeEntry.deleteMany({ where: { projectId: project.id } });
  await prisma.taskMention.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.task.deleteMany({ where: { projectId: project.id } });
  await prisma.projectAssignment.deleteMany({ where: { projectId: project.id } });
  await prisma.activityLog.deleteMany({ where: { projectId: project.id } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.project.deleteMany({ where: { id: project.id } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  console.log("\n ALL TASK BOARD, ASSIGNEE & TIME APPROVAL TESTS PASSED! \n");
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
