import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import { createNotification } from "@/lib/services/notifications";
import { canAccessProject } from "@/lib/auth/projects";
import type { SessionUser } from "@/lib/auth/session";
import type { TaskFormValues } from "@/lib/validations/task";
import type { Prisma, Task, TaskPriority, TaskStatus } from "@prisma/client";

const PAGE_SIZE = 15;

/** Active users who can be assigned to / tagged on a project's tasks: admins, assigned employees, and the project's client users. */
export async function listAssignableUsers(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      customerId: true,
      assignedToId: true,
      assignments: { select: { employeeId: true } },
    },
  });
  if (!project) return [];

  const employeeIds = project.assignments.map((a) => a.employeeId);
  if (project.assignedToId) employeeIds.push(project.assignedToId);

  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { role: "ADMIN" },
        { id: { in: employeeIds } },
        ...(project.customerId ? [{ role: "CLIENT" as const, customerId: project.customerId }] : []),
      ],
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

async function assertAssignable(projectId: string, userIds: string[], message: string) {
  if (userIds.length === 0) return;
  const allowed = new Set((await listAssignableUsers(projectId)).map((u) => u.id));
  if (userIds.some((id) => !allowed.has(id))) throw new Error(message);
}

export interface ListTasksParams {
  q?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: string;
  customerId?: string;
  orderId?: string;
  invoiceId?: string;
  projectId?: string;
  assignedToMe?: boolean;
  taggedMe?: boolean;
  page?: number;
}

/** A lightweight, uncompleted-tasks list for "link a task" selects (calendar events). */
export async function listTasksForPicker(projectId?: string) {
  return prisma.task.findMany({
    where: {
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { dueDate: "asc" },
    take: 100,
    select: { id: true, title: true },
  });
}

function buildTaskWhere(params: ListTasksParams, user?: SessionUser): Prisma.TaskWhereInput | null {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let dueDateWhere: Prisma.DateTimeFilter | undefined;
  if (params.dueDate === "today") {
    dueDateWhere = { gte: todayStart, lte: todayEnd };
  } else if (params.dueDate === "overdue") {
    dueDateWhere = { lt: todayStart };
  } else if (params.dueDate === "upcoming") {
    dueDateWhere = { gt: todayEnd };
  } else if (params.dueDate && params.dueDate.length === 10) {
    const d = new Date(params.dueDate);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    dueDateWhere = { gte: start, lte: end };
  }

  const where: Prisma.TaskWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(dueDateWhere ? { dueDate: dueDateWhere } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
    ...(params.orderId ? { orderId: params.orderId } : {}),
    ...(params.invoiceId ? { invoiceId: params.invoiceId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Role-based visibility scoping
  if (user?.role === "CLIENT") {
    if (!user.customerId) return null;
    where.project = { customerId: user.customerId };
  } else if (user?.role === "EMPLOYEE") {
    if (params.assignedToMe) {
      where.assignedToId = user.id;
    } else if (params.taggedMe) {
      where.mentions = { some: { employeeId: user.id } };
    } else if (!params.projectId) {
      // General employee view: tasks in assigned projects OR assigned to me OR tagged me
      where.OR = [
        { project: { assignments: { some: { employeeId: user.id } } } },
        { project: { assignedToId: user.id } },
        { assignedToId: user.id },
        { mentions: { some: { employeeId: user.id } } },
      ];
    }
  } else {
    // ADMIN
    if (params.assignedToMe && user) {
      where.assignedToId = user.id;
    } else if (params.taggedMe && user) {
      where.mentions = { some: { employeeId: user.id } };
    } else if (params.assignedToId) {
      where.assignedToId = params.assignedToId;
    }
  }

  return where;
}

const TASK_LIST_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  order: { select: { id: true, number: true } },
  project: { select: { id: true, name: true, customerId: true } },
  mentions: {
    include: {
      employee: { select: { id: true, name: true } },
      taggedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.TaskInclude;

export async function listTasks(params: ListTasksParams, user?: SessionUser) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where = buildTaskWhere(params, user);
    if (!where) return { tasks: [], total: 0, page: 1, pageSize: PAGE_SIZE };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { priority: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: TASK_LIST_INCLUDE,
      }),
      prisma.task.count({ where }),
    ]);

    return { tasks, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listTasks:", err);
    return { tasks: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

const BOARD_INCLUDE = {
  assignedTo: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, customerId: true } },
  mentions: { include: { employee: { select: { id: true, name: true } } } },
  timeEntries: {
    where: { endedAt: null },
    select: { id: true, userId: true, startedAt: true, user: { select: { name: true } } },
  },
} satisfies Prisma.TaskInclude;

/** Unpaginated tasks for the kanban board, ordered by manual position. Exposes display names only (no emails). */
export async function listTasksForBoard(params: ListTasksParams, user?: SessionUser) {
  try {
    const where = buildTaskWhere(params, user);
    if (!where) return [];
    return await prisma.task.findMany({
      where,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: 500,
      include: BOARD_INCLUDE,
    });
  } catch (err) {
    console.error("Error in listTasksForBoard:", err);
    return [];
  }
}

export type BoardTask = Awaited<ReturnType<typeof listTasksForBoard>>[number];

export type TaskListItem = Prisma.TaskGetPayload<{
  include: {
    assignedTo: { select: { id: true; name: true; email: true } };
    createdBy: { select: { id: true; name: true } };
    customer: { select: { id: true, name: true } };
    order: { select: { id: true; number: true } };
    project: { select: { id: true, name: true, customerId: true } };
    mentions: {
      include: {
        employee: { select: { id: true, name: true } };
        taggedBy: { select: { id: true, name: true } };
      };
    };
  };
}>;

export async function getTaskDetail(id: string, user?: SessionUser) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        order: { select: { id: true, number: true } },
        quotation: { select: { id: true, number: true } },
        invoice: { select: { id: true, number: true } },
        productionJob: { select: { id: true, number: true, itemName: true } },
        project: {
          select: {
            id: true,
            name: true,
            customerId: true,
            assignedToId: true,
            assignments: { select: { employeeId: true } },
          },
        },
        mentions: {
          include: {
            employee: { select: { id: true, name: true } },
            taggedBy: { select: { id: true, name: true } },
          },
        },
        activityLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!task) return null;

    if (user) {
      if (user.role === "CLIENT") {
        if (!user.customerId || task.project?.customerId !== user.customerId) {
          return null; // Don't leak existence
        }
      } else if (user.role === "EMPLOYEE" && task.project) {
        if (!canAccessProject(user, task.project)) {
          return null;
        }
      }
    }

    return task;
  } catch (err) {
    console.error("Error in getTaskDetail:", err);
    return null;
  }
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export function taskToFormValues(task: Task & { mentions?: Array<{ employeeId: string }> }): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    projectId: task.projectId ?? "",
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
    dueTime: task.dueTime ?? "",
    assignedToId: task.assignedToId ?? "",
    assigneeId: task.assignedToId ?? "",
    mentionUserIds: task.mentions?.map((m) => m.employeeId) ?? [],
    customerId: task.customerId ?? "",
    orderId: task.orderId ?? "",
    quotationId: task.quotationId ?? "",
    invoiceId: task.invoiceId ?? "",
    productionJobId: task.productionJobId ?? "",
    tags: task.tags ?? "",
    reminder: task.reminder ? new Date(task.reminder).toISOString().slice(0, 16) : "",
  };
}

export async function createTask(data: TaskFormValues, user?: SessionUser) {
  const assigneeId =
    data.assigneeId ||
    (data.assignedToId && data.assignedToId !== "unassigned" ? data.assignedToId : null);

  const targetProjectId = data.projectId || null;
  let projectName = "";

  // If a project is specified, validate project access and assignment constraints
  if (targetProjectId) {
    const project = await prisma.project.findUnique({
      where: { id: targetProjectId },
      include: {
        assignments: { select: { employeeId: true } },
      },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    projectName = project.name;

    if (user && !canAccessProject(user, project)) {
      throw new Error("You do not have permission to create tasks in this project.");
    }

    await assertAssignable(
      targetProjectId,
      assigneeId ? [assigneeId] : [],
      "Task assignee must be an admin, an employee assigned to this project, or this project's client."
    );
    await assertAssignable(
      targetProjectId,
      data.mentionUserIds ?? [],
      "Tagged people must be an admin, an employee assigned to this project, or this project's client."
    );
  }

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      projectId: targetProjectId,
      createdById: user?.id ?? null,
      createdByRole: user?.role ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      dueTime: data.dueTime || null,
      assignedToId: assigneeId,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      quotationId: data.quotationId || null,
      invoiceId: data.invoiceId || null,
      productionJobId: data.productionJobId || null,
      tags: data.tags || null,
      reminder: data.reminder ? new Date(data.reminder) : null,
      mentions: {
        create: (data.mentionUserIds || []).map((uid) => ({
          employeeId: uid,
          taggedById: user?.id ?? uid,
        })),
      },
    },
  });

  // Spec 4.3: Tag/assign triggers a notification to the employee
  if (assigneeId && assigneeId !== user?.id) {
    await createNotification({
      userId: assigneeId,
      title: "Task Assigned",
      message: `${user?.name || "Someone"} assigned you task "${task.title}"${projectName ? ` in project "${projectName}"` : ""}.`,
      type: "TASK_ASSIGNED",
      link: targetProjectId ? `/projects/${targetProjectId}` : `/tasks/${task.id}`,
    });
  }

  if (data.mentionUserIds && data.mentionUserIds.length > 0) {
    for (const uid of data.mentionUserIds) {
      if (uid !== user?.id && uid !== assigneeId) {
        await createNotification({
          userId: uid,
          title: "Tagged in Task",
          message: `${user?.name || "Someone"} tagged you in task "${task.title}"${projectName ? ` in project "${projectName}"` : ""}.`,
          type: "TASK_MENTIONED",
          link: targetProjectId ? `/projects/${targetProjectId}` : `/tasks/${task.id}`,
        });
      }
    }
  }

  // If created by a client, notify assigned employees or project owner
  if (user?.role === "CLIENT" && targetProjectId) {
    await logActivity({
      type: "client.task_created",
      message: `Client created task: "${task.title}"`,
      entityType: "task",
      entityId: task.id,
      projectId: targetProjectId,
      customerId: task.customerId ?? undefined,
      userId: user.id,
    });
  } else {
    await logActivity({
      type: "task.created",
      message: `Task created: "${task.title}"`,
      entityType: "task",
      entityId: task.id,
      projectId: targetProjectId ?? undefined,
      customerId: task.customerId ?? undefined,
      orderId: task.orderId ?? undefined,
      userId: user?.id,
    });
  }

  return task;
}

export async function updateTask(id: string, data: TaskFormValues, user?: SessionUser) {
  const existing = await prisma.task.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          assignments: { select: { employeeId: true } },
        },
      },
      mentions: true,
    },
  });

  if (!existing) {
    throw new Error("Task not found");
  }

  // Spec 4.3: Client permissions
  if (user?.role === "CLIENT") {
    if (existing.createdById !== user.id) {
      throw new Error("Clients can only edit or delete tasks they created themselves.");
    }
    if (data.status !== existing.status && existing.createdByRole !== "CLIENT") {
      throw new Error("Clients cannot change the status of team-owned tasks.");
    }
  }

  const assigneeId =
    data.assigneeId ||
    (data.assignedToId && data.assignedToId !== "unassigned" ? data.assignedToId : null);

  const targetProjectId = data.projectId || existing.projectId;

  if (targetProjectId) {
    const project =
      existing.projectId === targetProjectId
        ? existing.project
        : await prisma.project.findUnique({
            where: { id: targetProjectId },
            include: { assignments: { select: { employeeId: true } } },
          });

    if (project) {
      if (user && !canAccessProject(user, project)) {
        throw new Error("You do not have access to this project.");
      }

      await assertAssignable(
        targetProjectId,
        assigneeId ? [assigneeId] : [],
        "Task assignee must be an admin, an employee assigned to this project, or this project's client."
      );
      await assertAssignable(
        targetProjectId,
        data.mentionUserIds ?? [],
        "Tagged people must be an admin, an employee assigned to this project, or this project's client."
      );
    }
  }

  // Update mentions
  const currentMentionIds = existing.mentions.map((m) => m.employeeId);
  const newMentionIds = data.mentionUserIds || [];

  const mentionsToAdd = newMentionIds.filter((id) => !currentMentionIds.includes(id));
  const mentionsToRemove = currentMentionIds.filter((id) => !newMentionIds.includes(id));

  await prisma.$transaction([
    ...(mentionsToRemove.length > 0
      ? [
          prisma.taskMention.deleteMany({
            where: { taskId: id, employeeId: { in: mentionsToRemove } },
          }),
        ]
      : []),
    ...(mentionsToAdd.length > 0
      ? [
          prisma.taskMention.createMany({
            data: mentionsToAdd.map((uid) => ({
              taskId: id,
              employeeId: uid,
              taggedById: user?.id ?? uid,
            })),
          }),
        ]
      : []),
  ]);

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      projectId: targetProjectId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      dueTime: data.dueTime || null,
      assignedToId: assigneeId,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      quotationId: data.quotationId || null,
      invoiceId: data.invoiceId || null,
      productionJobId: data.productionJobId || null,
      tags: data.tags || null,
      reminder: data.reminder ? new Date(data.reminder) : null,
    },
  });

  // Notify new assignee
  if (assigneeId && assigneeId !== existing.assignedToId && assigneeId !== user?.id) {
    await createNotification({
      userId: assigneeId,
      title: "Task Assigned",
      message: `${user?.name || "Someone"} assigned you task "${task.title}".`,
      type: "TASK_ASSIGNED",
      link: targetProjectId ? `/projects/${targetProjectId}` : `/tasks/${task.id}`,
    });
  }

  // Notify newly mentioned users
  for (const uid of mentionsToAdd) {
    if (uid !== user?.id && uid !== assigneeId) {
      await createNotification({
        userId: uid,
        title: "Tagged in Task",
        message: `${user?.name || "Someone"} tagged you in task "${task.title}".`,
        type: "TASK_MENTIONED",
        link: targetProjectId ? `/projects/${targetProjectId}` : `/tasks/${task.id}`,
      });
    }
  }

  await logActivity({
    type: "task.updated",
    message: `Task updated: "${task.title}"`,
    entityType: "task",
    entityId: task.id,
    projectId: targetProjectId ?? undefined,
    customerId: task.customerId ?? undefined,
    orderId: task.orderId ?? undefined,
    userId: user?.id,
  });

  return task;
}

export interface MoveTaskInput {
  status: TaskStatus;
  /** Task that should sit directly above the moved task in the target column. */
  aboveId?: string | null;
  /** Task that should sit directly below the moved task in the target column. */
  belowId?: string | null;
}

export async function moveTask(id: string, input: MoveTaskInput, user?: SessionUser) {
  const existing = await prisma.task.findUnique({
    where: { id },
    include: { project: { include: { assignments: { select: { employeeId: true } } } } },
  });
  if (!existing) throw new Error("Task not found");

  if (user?.role === "CLIENT") {
    if (existing.createdById !== user.id) {
      throw new Error("Clients can only move tasks they created themselves.");
    }
  } else if (user?.role === "EMPLOYEE") {
    const hasAccess = existing.project
      ? canAccessProject(user, existing.project)
      : existing.assignedToId === user.id || existing.createdById === user.id;
    if (!hasAccess) throw new Error("You do not have access to this task.");
  }

  const neighbours = async () => {
    const [above, below] = await Promise.all([
      input.aboveId && input.aboveId !== id
        ? prisma.task.findFirst({ where: { id: input.aboveId, status: input.status }, select: { position: true } })
        : null,
      input.belowId && input.belowId !== id
        ? prisma.task.findFirst({ where: { id: input.belowId, status: input.status }, select: { position: true } })
        : null,
    ]);
    return { above: above?.position ?? null, below: below?.position ?? null };
  };

  let { above, below } = await neighbours();
  if (above !== null && below !== null && below - above < 1e-6) {
    const column = await prisma.task.findMany({
      where: { status: input.status, id: { not: id } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    await prisma.$transaction(async (tx) => {
      for (const [i, t] of column.entries()) {
        await tx.task.update({ where: { id: t.id }, data: { position: (i + 1) * 1000 } });
      }
    }, TX_OPTIONS);
    ({ above, below } = await neighbours());
  }

  const position =
    above !== null && below !== null
      ? (above + below) / 2
      : above !== null
        ? above + 1000
        : below !== null
          ? below - 1000
          : 0;

  const updated = await prisma.task.update({
    where: { id },
    data: { status: input.status, position },
  });

  if (existing.status !== input.status) {
    await logActivity({
      type: "task.status_changed",
      message: `Task "${updated.title}" moved to ${input.status}`,
      entityType: "task",
      entityId: updated.id,
      projectId: updated.projectId ?? undefined,
      customerId: updated.customerId ?? undefined,
      orderId: updated.orderId ?? undefined,
      userId: user?.id,
    });
  }

  return updated;
}

export async function toggleTaskStatus(id: string, user?: SessionUser) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Task not found");

  if (user?.role === "CLIENT") {
    if (existing.createdById !== user.id) {
      throw new Error("Clients cannot change the status of team-owned tasks.");
    }
  }

  const nextStatus: TaskStatus = existing.status === "COMPLETED" ? "TODO" : "COMPLETED";
  const updated = await prisma.task.update({
    where: { id },
    data: { status: nextStatus },
  });

  await logActivity({
    type: "task.status_changed",
    message: `Task status changed to ${nextStatus}`,
    entityType: "task",
    entityId: updated.id,
    projectId: updated.projectId ?? undefined,
    customerId: updated.customerId ?? undefined,
    orderId: updated.orderId ?? undefined,
    userId: user?.id,
  });

  return updated;
}

export async function deleteTask(id: string, user?: SessionUser) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Task not found");

  if (user?.role === "CLIENT") {
    if (existing.createdById !== user.id) {
      throw new Error("Clients can only edit or delete tasks they created themselves.");
    }
  }

  return prisma.task.delete({ where: { id } });
}
