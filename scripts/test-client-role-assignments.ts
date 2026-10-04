import assert from "node:assert";
import { prisma } from "../lib/prisma";
import * as projectService from "../lib/services/projects";
import * as taskService from "../lib/services/tasks";
import * as notificationService from "../lib/services/notifications";
import { canAccessProject, canStartTimerOnProject, toClientProjectDto } from "../lib/auth/projects";
import type { SessionUser } from "../lib/auth/session";

async function run() {
  console.log("=== Testing Client Role, Project Assignments & Task Management ===");

  const timestamp = Date.now();

  // 1. Create Admin, Employee, and Client users
  console.log("1) Creating test users...");
  const customerA = await prisma.customer.create({
    data: {
      type: "BUSINESS",
      name: `Test Client Corp ${timestamp}`,
      email: `client-corp-${timestamp}@example.com`,
      phone: `90000${timestamp.toString().slice(-5)}`,
      status: "ACTIVE",
    },
  });

  const customerB = await prisma.customer.create({
    data: {
      type: "BUSINESS",
      name: `Other Customer ${timestamp}`,
      email: `other-corp-${timestamp}@example.com`,
      phone: `91111${timestamp.toString().slice(-5)}`,
      status: "ACTIVE",
    },
  });

  const adminUser: SessionUser = {
    id: `admin-${timestamp}`,
    name: "Admin Tester",
    email: `admin-${timestamp}@priinteve.com`,
    role: "ADMIN",
  };
  await prisma.user.create({
    data: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const assignedEmployee: SessionUser = {
    id: `emp-assigned-${timestamp}`,
    name: "Assigned Dev",
    email: `dev-${timestamp}@priinteve.com`,
    role: "EMPLOYEE",
  };
  await prisma.user.create({
    data: {
      id: assignedEmployee.id,
      name: assignedEmployee.name,
      email: assignedEmployee.email,
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
  });

  const unassignedEmployee: SessionUser = {
    id: `emp-unassigned-${timestamp}`,
    name: "Unassigned Dev",
    email: `unassigned-${timestamp}@priinteve.com`,
    role: "EMPLOYEE",
  };
  await prisma.user.create({
    data: {
      id: unassignedEmployee.id,
      name: unassignedEmployee.name,
      email: unassignedEmployee.email,
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
  });

  const clientUserA: SessionUser = {
    id: `client-a-${timestamp}`,
    name: "Client Alice",
    email: `alice-${timestamp}@client.com`,
    role: "CLIENT",
    customerId: customerA.id,
  };
  await prisma.user.create({
    data: {
      id: clientUserA.id,
      name: clientUserA.name,
      email: clientUserA.email,
      role: "CLIENT",
      customerId: customerA.id,
      status: "ACTIVE",
    },
  });

  console.log("   OK: Created Customer A, Customer B, Admin, Assigned Employee, Unassigned Employee, Client User.");

  // 2. Create Projects
  console.log("2) Creating Project A (for Customer A) and Project B (for Customer B)...");
  const projectA = await projectService.createProject(
    {
      name: `Project Alpha ${timestamp}`,
      description: "Client Alpha Portal Overhaul",
      status: "NOT_STARTED",
      priority: "HIGH",
      customerId: customerA.id,
      assignedToId: "",
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: "Internal notes only visible to staff",
    },
    adminUser.id
  );

  const projectB = await projectService.createProject(
    {
      name: `Project Beta ${timestamp}`,
      description: "Secret Internal Project for Customer B",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      customerId: customerB.id,
      assignedToId: "",
      startDate: "",
      dueDate: "",
      notes: "",
    },
    adminUser.id
  );

  // 3. Test Scoping & Project Access
  console.log("3) Testing project access & permission scoping...");
  assert(canAccessProject(adminUser, projectA), "Admin should access all projects");
  assert(canAccessProject(clientUserA, projectA), "Client A should access Project A (own customer)");
  assert(!canAccessProject(clientUserA, projectB), "Client A must NOT access Project B (other customer)");
  assert(!canAccessProject(assignedEmployee, projectA), "Unassigned employee must not access Project A before assignment");

  // Client requesting other customer's project returns null (404, not leaking existence)
  const clientFetchOther = await projectService.getProjectById(projectB.id, clientUserA);
  assert(clientFetchOther === null, "Fetching other customer's project must return null (404) for client");

  const clientFetchOwn = await projectService.getProjectById(projectA.id, clientUserA);
  assert(clientFetchOwn !== null, "Fetching own customer's project must succeed");
  console.log("   OK: Access scoping and 404 existence masking verified.");

  // 4. Test Client Redaction DTO
  console.log("4) Testing Client Redaction DTO (Spec 4.1)...");
  const clientDto = toClientProjectDto(clientFetchOwn as any);
  assert(clientDto.name === projectA.name, "Client DTO has project name");
  assert(!("notes" in clientDto), "Client DTO must not leak internal notes");
  assert(!("hourlyRatePaise" in clientDto), "Client DTO must not leak financial rates");
  assert(!("costPaise" in clientDto), "Client DTO must not leak financial costs");
  console.log("   OK: Client DTO is properly redacted (no internal notes, rates or costs).");

  // 5. Test Employee Assignment (Spec 4.2)
  console.log("5) Testing Project Assignments...");
  await projectService.assignEmployeesToProject(
    projectA.id,
    [assignedEmployee.id],
    adminUser
  );

  const assignments = await projectService.getProjectAssignments(projectA.id);
  assert(assignments.length === 1, "Project should have 1 assignment");
  assert(assignments[0].employeeId === assignedEmployee.id, "Assigned employee ID matches");

  // Verify notification was sent to assigned employee
  const employeeNotifs = await notificationService.listUserNotifications(assignedEmployee.id);
  assert(
    employeeNotifs.some((n) => n.type === "PROJECT_ASSIGNED"),
    "Employee must receive a PROJECT_ASSIGNED notification"
  );
  console.log("   OK: Employee assigned and notification sent.");

  // 6. Test Timer Permissions & Execution (Spec 4.4)
  console.log("6) Testing employee timer on assigned project...");
  const projectAfterAssignment = await projectService.getProjectById(projectA.id);
  assert(canStartTimerOnProject(assignedEmployee, projectAfterAssignment!), "Assigned employee can start timer");
  assert(!canStartTimerOnProject(unassignedEmployee, projectAfterAssignment!), "Unassigned employee cannot start timer");
  assert(!canStartTimerOnProject(clientUserA, projectAfterAssignment!), "Client cannot start timer");

  // Start timer with task description
  const timerEntry = await projectService.startProjectTimer(
    projectA.id,
    assignedEmployee.id,
    "Developing feature A",
    null,
    { autoStopPrevious: true }
  );
  assert(timerEntry.status === "RUNNING", "Timer status should be RUNNING");
  console.log("   OK: Timer started with task description.");

  // Auto-stop previous timer when starting a new one on Project B (assign employee to B first)
  console.log("6b) Testing auto-stopping running timer on starting new timer...");
  await projectService.assignEmployeesToProject(projectB.id, [assignedEmployee.id], adminUser);
  const newTimerEntry = await projectService.startProjectTimer(
    projectB.id,
    assignedEmployee.id,
    "Developing feature B on project B",
    null,
    { autoStopPrevious: true }
  );
  assert(newTimerEntry.status === "RUNNING", "New timer should be RUNNING");
  assert(newTimerEntry.autoStoppedProjectName === projectA.name, "Should report previous timer project stopped");

  const stoppedOldEntry = await prisma.projectTimeEntry.findUnique({ where: { id: timerEntry.id } });
  assert(stoppedOldEntry?.status === "COMPLETED", "Previous timer must be auto-stopped");
  assert(stoppedOldEntry?.endedAt !== null, "Previous timer endedAt must be set");
  console.log("   OK: Previous timer auto-stopped when new timer started.");

  // Unassign employee with active timer auto-stops it (Spec 4.2)
  console.log("6c) Testing unassigning employee with active timer...");
  await projectService.unassignEmployeeFromProject(projectB.id, assignedEmployee.id, adminUser);
  const stoppedUnassignedEntry = await prisma.projectTimeEntry.findUnique({ where: { id: newTimerEntry.id } });
  assert(stoppedUnassignedEntry?.status === "COMPLETED", "Timer must be stopped when employee is unassigned");
  console.log("   OK: Active timer auto-stopped upon employee unassignment.");

  // 7. Test Task Creation, Mentions, and Assignment (Spec 4.3)
  console.log("7) Testing task creation, mentions, and client restrictions...");
  // Client creates a task on Project A and tags assigned employee
  const clientTask = await taskService.createTask(
    {
      title: "Please update the branding color palette",
      description: "Request from client",
      status: "TODO",
      priority: "HIGH",
      projectId: projectA.id,
      assignedToId: assignedEmployee.id,
      assigneeId: assignedEmployee.id,
      mentionUserIds: [assignedEmployee.id],
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      dueTime: "",
      customerId: customerA.id,
      orderId: "",
      quotationId: "",
      invoiceId: "",
      productionJobId: "",
      tags: "",
      reminder: "",
    },
    clientUserA
  );
  assert(clientTask.id, "Client task should be created");
  assert(clientTask.createdByRole === "CLIENT", "Task creator role should be CLIENT");

  // Verify notification was sent for mention and task assignment
  const notifsAfterTask = await notificationService.listUserNotifications(assignedEmployee.id);
  assert(
    notifsAfterTask.some((n) => n.type === "TASK_ASSIGNED" || n.type === "TASK_MENTIONED"),
    "Assigned employee must receive notification for task assignment / mention"
  );

  // Unassigned employee cannot be assigned/tagged to project task
  let invalidAssigneeError = false;
  try {
    await taskService.createTask(
      {
        title: "Invalid assignee test",
        description: "",
        status: "TODO",
        priority: "LOW",
        projectId: projectA.id,
        assignedToId: unassignedEmployee.id,
        assigneeId: unassignedEmployee.id,
        mentionUserIds: [],
        dueDate: "",
        dueTime: "",
        customerId: customerA.id,
        orderId: "",
        quotationId: "",
        invoiceId: "",
        productionJobId: "",
        tags: "",
        reminder: "",
      },
      clientUserA
    );
  } catch (err: any) {
    invalidAssigneeError = true;
    console.log("   OK: Blocked unassigned employee from being assigned to project task:", err.message);
  }
  assert(invalidAssigneeError, "Assigning unassigned employee to project task must be rejected");

  // Client cannot change status of team-owned tasks (Spec 4.3)
  const employeeTask = await taskService.createTask(
    {
      title: "Internal print plate setup",
      description: "Staff internal prepress",
      status: "TODO",
      priority: "MEDIUM",
      projectId: projectA.id,
      assignedToId: assignedEmployee.id,
      assigneeId: assignedEmployee.id,
      mentionUserIds: [],
      dueDate: "",
      dueTime: "",
      customerId: customerA.id,
      orderId: "",
      quotationId: "",
      invoiceId: "",
      productionJobId: "",
      tags: "",
      reminder: "",
    },
    assignedEmployee
  );

  let clientStatusError = false;
  try {
    await taskService.toggleTaskStatus(employeeTask.id, clientUserA);
  } catch (err: any) {
    clientStatusError = true;
    console.log("   OK: Blocked client from changing status of employee task:", err.message);
  }
  assert(clientStatusError, "Client should NOT be able to change status of employee-created task");

  // Client CAN toggle status of client's own task
  const toggledClientTask = await taskService.toggleTaskStatus(clientTask.id, clientUserA);
  assert(toggledClientTask.status === "COMPLETED", "Client can toggle status of their own task");
  console.log("   OK: Client successfully toggled status of their own task.");

  // 8. Test Client Time Entries View (Spec 4.5: Redacted, no rates/costs)
  console.log("8) Testing Client Time Entries endpoint view...");
  const clientEntries = await projectService.listProjectTimeEntries(projectA.id, clientUserA);
  assert(Array.isArray(clientEntries), "Should return array of entries");
  if (clientEntries.length > 0) {
    const entry = clientEntries[0] as any;
    assert(!("hourlyRatePaise" in entry), "Time entry must not include hourlyRatePaise");
    assert(!("costPaise" in entry), "Time entry must not include costPaise");
    assert(entry.taskDescription !== undefined, "Time entry includes taskDescription");
  }
  console.log("   OK: Client time entries are redacted without financial figures.");

  // 9. Cleanup Test Data
  console.log("9) Cleaning up test data...");
  await prisma.taskMention.deleteMany({ where: { taskId: { in: [clientTask.id, employeeTask.id] } } });
  await prisma.task.deleteMany({ where: { id: { in: [clientTask.id, employeeTask.id] } } });
  await prisma.projectTimeEntry.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
  await prisma.projectAssignment.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
  await prisma.activityLog.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [adminUser.id, assignedEmployee.id, unassignedEmployee.id, clientUserA.id] } } });
  await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, assignedEmployee.id, unassignedEmployee.id, clientUserA.id] } } });
  await prisma.customer.deleteMany({ where: { id: { in: [customerA.id, customerB.id] } } });

  console.log("   OK: All test entities cleaned up.");
  console.log("\n ALL CLIENT ROLE, PROJECT ASSIGNMENTS & TASK TESTS PASSED! \n");
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
