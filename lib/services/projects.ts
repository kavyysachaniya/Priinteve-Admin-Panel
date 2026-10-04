import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import { createNotification } from "@/lib/services/notifications";
import {
  canAccessProject,
  getVisibleProjectsQuery,
} from "@/lib/auth/projects";
import type { SessionUser } from "@/lib/auth/session";
import type { ProjectFormValues, TimeEntryUpdateValues } from "@/lib/validations/project";
import type { Prisma, ProjectPriority, ProjectStatus, TimeEntryStatus } from "@prisma/client";

const PAGE_SIZE = 15;

export interface ListProjectsParams {
  q?: string;
  status?: ProjectStatus | "ALL";
  priority?: ProjectPriority | "ALL";
  assignedToId?: string;
  customerId?: string;
  hasActiveTimer?: boolean;
  sort?: "createdAt" | "dueDate" | "name" | "totalTime" | "priority";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export type ProjectListItem = Prisma.ProjectGetPayload<{
  include: {
    customer: { select: { id: true; name: true; email: true; phone: true } };
    assignedTo: { select: { id: true; name: true; email: true } };
    createdBy: { select: { id: true; name: true } };
    assignments: {
      include: {
        employee: { select: { id: true; name: true; email: true } };
      };
    };
    tasks: {
      select: { id: true; title: true; status: true; priority: true };
    };
    timeEntries: {
      include: {
        user: { select: { id: true; name: true } };
      };
    };
  };
}> & {
  totalDurationSeconds: number;
  activeTimer: {
    id: string;
    startedAt: Date;
    elapsedSeconds: number;
    userId: string | null;
    userName: string | null;
    taskDescription?: string | null;
    taskId?: string | null;
  } | null;
  timerStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
};

export type ProjectDetail = Prisma.ProjectGetPayload<{
  include: {
    customer: { select: { id: true; name: true; email: true; phone: true } };
    assignedTo: { select: { id: true; name: true; email: true } };
    createdBy: { select: { id: true; name: true } };
    assignments: {
      include: {
        employee: { select: { id: true; name: true; email: true } };
        assignedBy: { select: { id: true; name: true } };
      };
    };
    tasks: {
      include: {
        assignedTo: { select: { id: true; name: true, email: true } };
        createdBy: { select: { id: true; name: true } };
        mentions: {
          include: {
            employee: { select: { id: true; name: true } };
            taggedBy: { select: { id: true; name: true } };
          };
        };
      };
      orderBy: { createdAt: "desc" };
    };
    timeEntries: {
      include: {
        user: { select: { id: true; name: true, email: true } };
        task: { select: { id: true, title: true } };
      };
      orderBy: { startedAt: "desc" };
    };
    activityLogs: {
      include: {
        user: { select: { id: true; name: true } };
      };
      orderBy: { createdAt: "desc" };
    };
  };
}> & {
  totalDurationSeconds: number;
  activeTimer: {
    id: string;
    startedAt: Date;
    elapsedSeconds: number;
    userId: string | null;
    userName: string | null;
    taskDescription?: string | null;
    taskId?: string | null;
  } | null;
  timerStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
};

export type ProjectWithDetails = ProjectListItem;

/**
 * Calculates current project duration and active timer details based on server time
 */
export function computeProjectTimerMetrics(project: {
  status: ProjectStatus;
  timeEntries: Array<{
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    durationSeconds: number;
    status: TimeEntryStatus;
    userId?: string | null;
    user?: { id: string; name: string } | null;
    taskDescription?: string | null;
    taskId?: string | null;
    notes?: string | null;
  }>;
}, options: { approvedOnly?: boolean } = {}) {
  const now = Date.now();
  let totalDurationSeconds = 0;
  let runningEntry: (typeof project.timeEntries)[0] | null = null;
  let latestEntry: (typeof project.timeEntries)[0] | null = null;

  for (const entry of project.timeEntries) {
    if (!latestEntry || new Date(entry.startedAt).getTime() > new Date(latestEntry.startedAt).getTime()) {
      latestEntry = entry;
    }

    if (entry.status === "RUNNING") {
      runningEntry = entry;
      const startedTime = new Date(entry.startedAt).getTime();
      const currentSessionElapsed = Math.max(0, Math.floor((now - startedTime) / 1000));
      if (!options.approvedOnly) totalDurationSeconds += currentSessionElapsed;
    } else {
      totalDurationSeconds += entry.durationSeconds || 0;
    }
  }

  let timerStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" = "IDLE";
  if (project.status === "COMPLETED") {
    timerStatus = "COMPLETED";
  } else if (runningEntry) {
    timerStatus = "RUNNING";
  } else if (latestEntry && latestEntry.status === "PAUSED") {
    timerStatus = "PAUSED";
  }

  const activeTimer = runningEntry
    ? {
        id: runningEntry.id,
        startedAt: new Date(runningEntry.startedAt),
        elapsedSeconds: Math.max(0, Math.floor((now - new Date(runningEntry.startedAt).getTime()) / 1000)),
        userId: runningEntry.userId ?? null,
        userName: runningEntry.user?.name ?? null,
        taskDescription: runningEntry.taskDescription || runningEntry.notes || null,
        taskId: runningEntry.taskId ?? null,
      }
    : null;

  return {
    totalDurationSeconds,
    activeTimer,
    timerStatus,
  };
}

/** Clients only see approved time (plus the live running entry, which never counts toward totals). */
function visibleTimeEntries<T extends { status: TimeEntryStatus; approvedAt: Date | null }>(
  entries: T[],
  user?: SessionUser
): T[] {
  if (user?.role !== "CLIENT") return entries;
  return entries.filter((e) => e.status === "RUNNING" || e.approvedAt !== null);
}

function withClientAwareMetrics<
  P extends { status: ProjectStatus; timeEntries: Array<{ id: string; startedAt: Date; endedAt: Date | null; durationSeconds: number; status: TimeEntryStatus; approvedAt: Date | null }> },
>(project: P, user?: SessionUser) {
  const timeEntries = visibleTimeEntries(project.timeEntries, user);
  const metrics = computeProjectTimerMetrics({ ...project, timeEntries }, { approvedOnly: user?.role === "CLIENT" });
  return { ...project, timeEntries, ...metrics };
}

export async function listProjects(params: ListProjectsParams = {}, user?: SessionUser) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;

  // Base user role scoping
  const userScope = user ? getVisibleProjectsQuery(user) : {};

  const where: Prisma.ProjectWhereInput = {
    AND: [
      userScope,
      ...(params.status && params.status !== "ALL" ? [{ status: params.status }] : []),
      ...(params.priority && params.priority !== "ALL" ? [{ priority: params.priority }] : []),
      ...(params.assignedToId ? [{ assignedToId: params.assignedToId }] : []),
      ...(params.customerId ? [{ customerId: params.customerId }] : []),
      ...(params.hasActiveTimer
        ? [
            {
              timeEntries: {
                some: {
                  status: "RUNNING" as TimeEntryStatus,
                },
              },
            },
          ]
        : []),
      ...(params.q
        ? [
            {
              OR: [
                { name: { contains: params.q, mode: "insensitive" as Prisma.QueryMode } },
                { description: { contains: params.q, mode: "insensitive" as Prisma.QueryMode } },
                { customer: { name: { contains: params.q, mode: "insensitive" as Prisma.QueryMode } } },
                { assignedTo: { name: { contains: params.q, mode: "insensitive" as Prisma.QueryMode } } },
              ],
            },
          ]
        : []),
    ],
  };

  const orderBy: Prisma.ProjectOrderByWithRelationInput[] = [];
  const orderDirection = params.order ?? "desc";

  if (params.sort === "name") {
    orderBy.push({ name: orderDirection });
  } else if (params.sort === "dueDate") {
    orderBy.push({ dueDate: orderDirection });
  } else if (params.sort === "priority") {
    orderBy.push({ priority: orderDirection });
  } else if (params.sort === "createdAt" || !params.sort || params.sort !== "totalTime") {
    orderBy.push({ createdAt: orderDirection });
  }

  if (params.sort === "totalTime") {
    const matchingIds = await prisma.project.findMany({ where, select: { id: true } });
    const ids = matchingIds.map((p) => p.id);

    const [durationSums, runningEntries] = await Promise.all([
      ids.length
        ? prisma.projectTimeEntry.groupBy({
            by: ["projectId"],
            where: { projectId: { in: ids } },
            _sum: { durationSeconds: true },
          })
        : [],
      ids.length
        ? prisma.projectTimeEntry.findMany({
            where: { projectId: { in: ids }, status: "RUNNING" },
            select: { projectId: true, startedAt: true },
          })
        : [],
    ]);

    const now = Date.now();
    const totals = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const row of durationSums) {
      totals.set(row.projectId, (totals.get(row.projectId) ?? 0) + (row._sum.durationSeconds ?? 0));
    }
    for (const entry of runningEntries) {
      const elapsed = Math.max(0, Math.floor((now - new Date(entry.startedAt).getTime()) / 1000));
      totals.set(entry.projectId, (totals.get(entry.projectId) ?? 0) + elapsed);
    }

    const sortedIds = [...ids].sort((a, b) => {
      const diff = (totals.get(a) ?? 0) - (totals.get(b) ?? 0);
      return orderDirection === "asc" ? diff : -diff;
    });

    const total = sortedIds.length;
    const pageIds = sortedIds.slice((page - 1) * pageSize, page * pageSize);

    const pageProjectsRaw = pageIds.length
      ? await prisma.project.findMany({
          where: { id: { in: pageIds } },
          include: {
            customer: { select: { id: true, name: true, email: true, phone: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true } },
            assignments: {
              include: {
                employee: { select: { id: true, name: true, email: true } },
              },
            },
            tasks: {
              select: { id: true, title: true, status: true, priority: true },
            },
            timeEntries: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        })
      : [];

    const byId = new Map(pageProjectsRaw.map((p) => [p.id, p]));
    const orderedRaw = pageIds.map((id) => byId.get(id)).filter((p): p is (typeof pageProjectsRaw)[number] => Boolean(p));

    const projects = orderedRaw.map((p) => withClientAwareMetrics(p, user));

    return {
      projects,
      total,
      page,
      pageSize,
    };
  }

  const [projectsRaw, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        assignments: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
          },
        },
        tasks: {
          select: { id: true, title: true, status: true, priority: true },
        },
        timeEntries: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  const projects = projectsRaw.map((p) => withClientAwareMetrics(p, user));

  return {
    projects,
    total,
    page,
    pageSize,
  };
}

export async function getProjectById(id: string, user?: SessionUser): Promise<ProjectDetail | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      assignments: {
        include: {
          employee: { select: { id: true, name: true, email: true } },
          assignedBy: { select: { id: true, name: true } },
        },
      },
      tasks: {
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          mentions: {
            include: {
              employee: { select: { id: true, name: true } },
              taggedBy: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      timeEntries: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { startedAt: "desc" },
      },
      activityLogs: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) return null;

  // Enforce access control if user provided
  if (user) {
    if (!canAccessProject(user, project)) {
      // Spec 4.1: Requesting another customer's project returns 404, not 403, to avoid leaking existence
      return null;
    }
  }

  return withClientAwareMetrics(project, user);
}

export async function getProjectStats(user?: SessionUser) {
  const baseWhere = user ? getVisibleProjectsQuery(user) : {};

  const [totalProjects, inProgressProjects, completedProjects, notStartedProjects, onHoldProjects, trackedAgg, runningEntries] =
    await Promise.all([
      prisma.project.count({ where: baseWhere }),
      prisma.project.count({ where: { AND: [baseWhere, { status: "IN_PROGRESS" }] } }),
      prisma.project.count({ where: { AND: [baseWhere, { status: "COMPLETED" }] } }),
      prisma.project.count({ where: { AND: [baseWhere, { status: "NOT_STARTED" }] } }),
      prisma.project.count({ where: { AND: [baseWhere, { status: "ON_HOLD" }] } }),
      prisma.projectTimeEntry.aggregate({
        where: {
          AND: [
            { project: baseWhere },
            { status: { not: "RUNNING" as TimeEntryStatus } },
          ],
        },
        _sum: { durationSeconds: true },
      }),
      prisma.projectTimeEntry.findMany({
        where: {
          AND: [
            { project: baseWhere },
            { status: "RUNNING" as TimeEntryStatus },
          ],
        },
        select: { startedAt: true },
      }),
    ]);

  const now = Date.now();
  let totalTrackedSeconds = trackedAgg._sum.durationSeconds ?? 0;
  const activeTimersCount = runningEntries.length;

  for (const entry of runningEntries) {
    const started = new Date(entry.startedAt).getTime();
    totalTrackedSeconds += Math.max(0, Math.floor((now - started) / 1000));
  }

  return {
    totalProjects,
    inProgressProjects,
    completedProjects,
    notStartedProjects,
    onHoldProjects,
    totalTrackedSeconds,
    activeTimersCount,
  };
}

export async function createProject(values: ProjectFormValues, userId?: string) {
  const project = await prisma.project.create({
    data: {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      status: values.status,
      priority: values.priority,
      customerId: values.customerId || null,
      assignedToId: values.assignedToId || null,
      startDate: values.startDate ? new Date(values.startDate) : null,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      notes: values.notes?.trim() || null,
      createdById: userId || null,
      assignments:
        values.assignedEmployeeIds && values.assignedEmployeeIds.length > 0 && userId
          ? {
              create: values.assignedEmployeeIds.map((empId) => ({
                employeeId: empId,
                assignedById: userId,
              })),
            }
          : undefined,
    },
  });

  if (values.assignedEmployeeIds && values.assignedEmployeeIds.length > 0) {
    for (const empId of values.assignedEmployeeIds) {
      await createNotification({
        userId: empId,
        title: "Project Assignment",
        message: `You were assigned to project "${project.name}".`,
        type: "PROJECT_ASSIGNMENT",
        link: `/projects/${project.id}`,
      });
    }
  }

  await logActivity({
    type: "PROJECT_CREATED",
    message: `Project "${project.name}" was created.`,
    entityType: "project",
    entityId: project.id,
    projectId: project.id,
    customerId: project.customerId,
    userId: userId || null,
  }).catch(() => {});

  return project;
}

export async function updateProject(id: string, values: ProjectFormValues, userId?: string) {
  const existing = await prisma.project.findUnique({
    where: { id },
    include: {
      timeEntries: { where: { status: "RUNNING" } },
      assignments: true,
    },
  });

  if (!existing) {
    throw new Error("Project not found");
  }

  const now = new Date();

  // If status is transitioning to COMPLETED, stop any running timers and complete paused sessions
  if (values.status === "COMPLETED" && existing.status !== "COMPLETED") {
    for (const running of existing.timeEntries) {
      const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(running.startedAt).getTime()) / 1000));
      await prisma.projectTimeEntry.update({
        where: { id: running.id },
        data: {
          status: "COMPLETED",
          endedAt: now,
          durationSeconds: elapsed,
        },
      });
    }
    // Complete any paused entries as well
    await prisma.projectTimeEntry.updateMany({
      where: { projectId: id, status: "PAUSED" },
      data: { status: "COMPLETED" },
    });
  }

  // Handle employee assignments update if provided
  if (values.assignedEmployeeIds !== undefined && userId) {
    const existingEmployeeIds = existing.assignments.map((a) => a.employeeId);
    const toRemove = existingEmployeeIds.filter((empId) => !values.assignedEmployeeIds!.includes(empId));
    const toAdd = values.assignedEmployeeIds.filter((empId) => !existingEmployeeIds.includes(empId));

    // Spec 4.2: Removing an assignment while employee has an active timer stops the timer first
    for (const empId of toRemove) {
      const running = await prisma.projectTimeEntry.findFirst({
        where: { projectId: id, userId: empId, status: "RUNNING" },
      });
      if (running) {
        const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(running.startedAt).getTime()) / 1000));
        await prisma.projectTimeEntry.update({
          where: { id: running.id },
          data: { status: "COMPLETED", endedAt: now, durationSeconds: elapsed },
        });
      }
    }

    if (toRemove.length > 0) {
      await prisma.projectAssignment.deleteMany({
        where: { projectId: id, employeeId: { in: toRemove } },
      });
    }

    if (toAdd.length > 0) {
      await prisma.projectAssignment.createMany({
        data: toAdd.map((empId) => ({
          projectId: id,
          employeeId: empId,
          assignedById: userId,
          assignedAt: now,
        })),
      });

      for (const empId of toAdd) {
        await createNotification({
          userId: empId,
          title: "Project Assignment",
          message: `You were assigned to project "${values.name}".`,
          type: "PROJECT_ASSIGNMENT",
          link: `/projects/${id}`,
        });
      }
    }
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      status: values.status,
      priority: values.priority,
      customerId: values.customerId || null,
      assignedToId: values.assignedToId || null,
      startDate: values.startDate ? new Date(values.startDate) : null,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      notes: values.notes?.trim() || null,
    },
  });

  const activityType =
    values.status === "COMPLETED" && existing.status !== "COMPLETED"
      ? "PROJECT_COMPLETED"
      : "PROJECT_UPDATED";

  await logActivity({
    type: activityType,
    message: `Project "${updated.name}" was ${activityType === "PROJECT_COMPLETED" ? "completed" : "updated"}.`,
    entityType: "project",
    entityId: updated.id,
    projectId: updated.id,
    customerId: updated.customerId,
    userId: userId || null,
  }).catch(() => {});

  return updated;
}

export async function deleteProject(id: string, userId?: string) {
  const existing = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, customerId: true },
  });

  if (!existing) {
    throw new Error("Project not found");
  }

  await logActivity({
    type: "PROJECT_DELETED",
    message: `Project "${existing.name}" was deleted.`,
    entityType: "project",
    entityId: existing.id,
    projectId: existing.id,
    customerId: existing.customerId,
    userId: userId || null,
  }).catch(() => {});

  return prisma.project.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Assignment Operations (Spec 4.2)
// ---------------------------------------------------------------------------

export async function getProjectAssignments(projectId: string) {
  return prisma.projectAssignment.findMany({
    where: { projectId },
    include: {
      employee: {
        select: { id: true, name: true, email: true },
      },
      assignedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { assignedAt: "asc" },
  });
}

export async function assignEmployeesToProject(
  projectId: string,
  employeeIds: string[],
  adminUser: SessionUser
) {
  if (adminUser.role !== "ADMIN") {
    throw new Error("Only administrators can assign employees to projects.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { assignments: true },
  });

  if (!project) throw new Error("Project not found");

  const existingEmployeeIds = project.assignments.map((a) => a.employeeId);
  const toAdd = employeeIds.filter((id) => !existingEmployeeIds.includes(id));
  const toRemove = existingEmployeeIds.filter((id) => !employeeIds.includes(id));

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const empId of toRemove) {
      const running = await tx.projectTimeEntry.findFirst({
        where: {
          projectId,
          userId: empId,
          status: "RUNNING",
        },
      });
      if (running) {
        const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(running.startedAt).getTime()) / 1000));
        await tx.projectTimeEntry.update({
          where: { id: running.id },
          data: {
            status: "COMPLETED",
            endedAt: now,
            durationSeconds: elapsed,
          },
        });
      }
    }

    if (toRemove.length > 0) {
      await tx.projectAssignment.deleteMany({
        where: {
          projectId,
          employeeId: { in: toRemove },
        },
      });
    }

    if (toAdd.length > 0) {
      await tx.projectAssignment.createMany({
        data: toAdd.map((empId) => ({
          projectId,
          employeeId: empId,
          assignedById: adminUser.id,
          assignedAt: now,
        })),
      });
    }
  }, TX_OPTIONS);

  for (const empId of toAdd) {
    await createNotification({
      userId: empId,
      title: "Project Assignment",
      message: `You were assigned to project "${project.name}" by ${adminUser.name}.`,
      type: "PROJECT_ASSIGNED",
      link: `/projects/${projectId}`,
    });
  }

  await logActivity({
    type: "PROJECT_ASSIGNMENTS_UPDATED",
    message: `Team assignments updated for project "${project.name}".`,
    entityType: "project",
    entityId: project.id,
    projectId: project.id,
    userId: adminUser.id,
  }).catch(() => {});

  return getProjectAssignments(projectId);
}

export async function unassignEmployeeFromProject(
  projectId: string,
  employeeId: string,
  adminUser: SessionUser
) {
  if (adminUser.role !== "ADMIN") {
    throw new Error("Only administrators can unassign employees from projects.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new Error("Project not found");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const running = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        userId: employeeId,
        status: "RUNNING",
      },
    });
    if (running) {
      const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(running.startedAt).getTime()) / 1000));
      await tx.projectTimeEntry.update({
        where: { id: running.id },
        data: {
          status: "COMPLETED",
          endedAt: now,
          durationSeconds: elapsed,
        },
      });
    }

    await tx.projectAssignment.deleteMany({
      where: {
        projectId,
        employeeId,
      },
    });
  }, TX_OPTIONS);

  await logActivity({
    type: "PROJECT_ASSIGNMENT_REMOVED",
    message: `Employee removed from project "${project.name}".`,
    entityType: "project",
    entityId: project.id,
    projectId: project.id,
    userId: adminUser.id,
  }).catch(() => {});

  return { success: true };
}

// ---------------------------------------------------------------------------
// Timer Operations (Spec 4.4 & 4.5)
// ---------------------------------------------------------------------------

export async function startProjectTimer(
  projectId: string,
  userId?: string,
  taskDescription?: string,
  taskId?: string | null,
  options?: { autoStopPrevious?: boolean }
) {
  let projectName = "";
  let customerId: string | null = null;
  let autoStoppedProjectName: string | null = null;

  const timeEntry = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        assignments: { select: { employeeId: true } },
      },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    projectName = project.name;
    customerId = project.customerId;

    if (project.status === "COMPLETED") {
      throw new Error("Cannot start timer on a completed project. Please reopen the project first.");
    }

    // Role verification
    if (userId) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (user && user.role === "EMPLOYEE") {
        const isAssigned =
          project.assignments.some((a) => a.employeeId === userId) ||
          project.assignedToId === userId;
        if (!isAssigned) {
          throw new Error("You must be assigned to this project to start the timer.");
        }
      } else if (user && user.role === "CLIENT") {
        throw new Error("Clients cannot start timers.");
      }
    }

    // Check if this project already has an active running timer
    const existingRunning = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        status: "RUNNING",
      },
    });

    // If options.autoStopPrevious is NOT set (e.g. test scripts), enforce strict checks
    if (!options?.autoStopPrevious) {
      if (existingRunning) {
        throw new Error("This project already has an active timer.");
      }

      if (userId) {
        const userActiveTimer = await tx.projectTimeEntry.findFirst({
          where: {
            userId,
            status: "RUNNING",
          },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        if (userActiveTimer) {
          throw new Error(
            `You already have an active timer running on project "${userActiveTimer.project?.name || "another project"}". Please pause or stop it first.`
          );
        }
      }
    } else {
      // Auto-stop previous timer for user (Spec 4.4)
      if (userId) {
        const userActiveTimer = await tx.projectTimeEntry.findFirst({
          where: {
            userId,
            status: "RUNNING",
          },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        if (userActiveTimer) {
          const now = new Date();
          autoStoppedProjectName = userActiveTimer.project?.name || "another project";
          const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(userActiveTimer.startedAt).getTime()) / 1000));
          const isFlagged = elapsed > 43200; // >12 hours
          await tx.projectTimeEntry.update({
            where: { id: userActiveTimer.id },
            data: {
              status: "COMPLETED",
              endedAt: now,
              durationSeconds: elapsed,
              flaggedForReview: isFlagged,
            },
          });
        }
      }

      // If another user is running a timer on this project, ensure only 1 active per project
      const otherRunning = await tx.projectTimeEntry.findFirst({
        where: {
          projectId,
          status: "RUNNING",
          ...(userId ? { userId: { not: userId } } : {}),
        },
      });
      if (otherRunning) {
        throw new Error("This project already has an active timer.");
      }
    }

    const now = new Date();
    const finalDescription = taskDescription?.trim() || "Working on project";

    const entry = await tx.projectTimeEntry.create({
      data: {
        projectId,
        userId: userId || null,
        startedAt: now,
        status: "RUNNING",
        taskDescription: finalDescription,
        notes: finalDescription,
        taskId: taskId || null,
      },
    });

    if (project.status === "NOT_STARTED") {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "IN_PROGRESS" },
      });
    }

    return entry;
  }, TX_OPTIONS);

  logActivity({
    type: "TIMER_STARTED",
    message: `Timer started on project "${projectName}".`,
    entityType: "project",
    entityId: projectId,
    projectId,
    customerId,
    userId: userId || null,
  }).catch(() => {});

  return Object.assign(timeEntry, { autoStoppedProjectName });
}

export async function pauseProjectTimer(projectId: string, userId?: string) {
  let projectName = "";
  let customerId: string | null = null;
  let elapsed = 0;

  const updated = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, customerId: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    projectName = project.name;
    customerId = project.customerId;

    const runningEntry = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        status: "RUNNING",
      },
      orderBy: { startedAt: "desc" },
    });

    if (!runningEntry) {
      throw new Error("No active running timer found for this project.");
    }

    if (runningEntry.userId !== userId) {
      throw new Error("You can only control your own timer.");
    }

    const now = new Date();
    elapsed = Math.max(0, Math.floor((now.getTime() - new Date(runningEntry.startedAt).getTime()) / 1000));
    const isFlagged = elapsed > 43200;

    return tx.projectTimeEntry.update({
      where: { id: runningEntry.id },
      data: {
        status: "PAUSED",
        endedAt: now,
        durationSeconds: elapsed,
        flaggedForReview: isFlagged,
      },
    });
  }, TX_OPTIONS);

  logActivity({
    type: "TIMER_PAUSED",
    message: `Timer paused on project "${projectName}". Recorded session: ${elapsed}s.`,
    entityType: "project",
    entityId: projectId,
    projectId,
    customerId,
    userId: userId || null,
  }).catch(() => {});

  return updated;
}

export async function resumeProjectTimer(projectId: string, userId?: string) {
  let projectName = "";
  let customerId: string | null = null;

  const resumedEntry = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true, customerId: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    projectName = project.name;
    customerId = project.customerId;

    if (project.status === "COMPLETED") {
      throw new Error("Cannot resume timer on a completed project.");
    }

    const existingRunning = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        status: "RUNNING",
      },
    });

    if (existingRunning) {
      throw new Error("This project already has an active timer.");
    }

    if (userId) {
      const userActiveTimer = await tx.projectTimeEntry.findFirst({
        where: {
          userId,
          status: "RUNNING",
        },
        include: {
          project: { select: { id: true, name: true } },
        },
      });

      if (userActiveTimer) {
        throw new Error(
          `You already have an active timer running on project "${userActiveTimer.project?.name || "another project"}". Please pause or stop it first.`
        );
      }
    }

    const lastEntry = await tx.projectTimeEntry.findFirst({
      where: { projectId },
      orderBy: { startedAt: "desc" },
    });

    const now = new Date();

    const entry = await tx.projectTimeEntry.create({
      data: {
        projectId,
        userId: userId || null,
        startedAt: now,
        status: "RUNNING",
        taskDescription: lastEntry?.taskDescription || "Resumed project work",
        notes: lastEntry?.notes || "Resumed project work",
        taskId: lastEntry?.taskId || null,
      },
    });

    if (project.status === "NOT_STARTED" || project.status === "ON_HOLD") {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "IN_PROGRESS" },
      });
    }

    return entry;
  }, TX_OPTIONS);

  logActivity({
    type: "TIMER_RESUMED",
    message: `Timer resumed on project "${projectName}".`,
    entityType: "project",
    entityId: projectId,
    projectId,
    customerId,
    userId: userId || null,
  }).catch(() => {});

  return resumedEntry;
}

export async function stopProjectTimer(
  projectId: string,
  userId?: string,
  taskDescription?: string
) {
  let projectName = "";
  let customerId: string | null = null;
  let elapsed = 0;

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, customerId: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    projectName = project.name;
    customerId = project.customerId;

    const now = new Date();

    const runningEntry = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        status: "RUNNING",
      },
      orderBy: { startedAt: "desc" },
    });

    if (runningEntry) {
      if (runningEntry.userId && userId && runningEntry.userId !== userId) {
        const caller = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (caller?.role !== "ADMIN") {
          throw new Error("You can only control your own timer.");
        }
      }

      elapsed = Math.max(0, Math.floor((now.getTime() - new Date(runningEntry.startedAt).getTime()) / 1000));
      const isFlagged = elapsed > 43200; // >12 hours safety

      await tx.projectTimeEntry.update({
        where: { id: runningEntry.id },
        data: {
          status: "COMPLETED",
          endedAt: now,
          durationSeconds: elapsed,
          flaggedForReview: isFlagged,
          ...(taskDescription ? { taskDescription, notes: taskDescription } : {}),
        },
      });
    }

    await tx.projectTimeEntry.updateMany({
      where: {
        projectId,
        status: "PAUSED",
      },
      data: {
        status: "COMPLETED",
      },
    });
  }, TX_OPTIONS);

  logActivity({
    type: "TIMER_STOPPED",
    message: `Timer stopped on project "${projectName}".`,
    entityType: "project",
    entityId: projectId,
    projectId,
    customerId,
    userId: userId || null,
  }).catch(() => {});

  return { success: true, elapsedSeconds: elapsed };
}

export async function getActiveTimerForUser(userId: string) {
  const activeEntry = await prisma.projectTimeEntry.findFirst({
    where: {
      userId,
      status: "RUNNING",
    },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  if (!activeEntry) return null;

  const now = Date.now();
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(activeEntry.startedAt).getTime()) / 1000)
  );

  return {
    id: activeEntry.id,
    projectId: activeEntry.projectId,
    projectName: activeEntry.project.name,
    taskId: activeEntry.taskId,
    taskTitle: activeEntry.task?.title || null,
    taskDescription: activeEntry.taskDescription || activeEntry.notes || "Working on project",
    startedAt: activeEntry.startedAt,
    elapsedSeconds,
  };
}

export async function stopActiveTimerForUser(userId: string, taskDescription?: string) {
  const activeEntry = await prisma.projectTimeEntry.findFirst({
    where: {
      userId,
      status: "RUNNING",
    },
  });

  if (!activeEntry) {
    throw new Error("No active running timer found.");
  }

  return stopProjectTimer(activeEntry.projectId, userId, taskDescription);
}

// ---------------------------------------------------------------------------
// Time Entry Corrections (Spec 4.4)
// ---------------------------------------------------------------------------

export async function updateTimeEntry(
  id: string,
  values: TimeEntryUpdateValues,
  user: SessionUser
) {
  const entry = await prisma.projectTimeEntry.findUnique({
    where: { id },
  });

  if (!entry) {
    throw new Error("Time entry not found");
  }

  // Spec 4.4: Admin can edit any time entry. Employees can edit only their own entries within 24 hours.
  if (user.role !== "ADMIN") {
    if (entry.userId !== user.id) {
      throw new Error("You can only edit your own time entries.");
    }
    const ageMs = Date.now() - new Date(entry.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      throw new Error("Time entries can only be edited within 24 hours of creation.");
    }
  }

  let startedAt = entry.startedAt;
  let endedAt = entry.endedAt;

  if (values.startedAt) {
    startedAt = new Date(values.startedAt);
  }
  if (values.endedAt !== undefined) {
    endedAt = values.endedAt ? new Date(values.endedAt) : null;
  }

  let durationSeconds = values.durationSeconds ?? entry.durationSeconds;
  if (endedAt && startedAt) {
    if (endedAt.getTime() < startedAt.getTime()) {
      throw new Error("End time must be after start time.");
    }
    if (values.durationSeconds === undefined) {
      durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
    }
  }

  // Overlapping check for this user
  if (entry.userId && endedAt) {
    const overlap = await prisma.projectTimeEntry.findFirst({
      where: {
        id: { not: id },
        userId: entry.userId,
        endedAt: { not: null },
        startedAt: { lt: endedAt },
        AND: [{ endedAt: { gt: startedAt } }],
      },
    });

    if (overlap) {
      throw new Error("This time period overlaps with another recorded time entry.");
    }
  }

  const isFlagged = durationSeconds > 43200;

  return prisma.projectTimeEntry.update({
    where: { id },
    data: {
      startedAt,
      endedAt,
      durationSeconds,
      flaggedForReview: isFlagged,
      approvedAt: null,
      approvedById: null,
      ...(values.taskDescription ? { taskDescription: values.taskDescription, notes: values.taskDescription } : {}),
    },
  });
}

export async function deleteTimeEntry(id: string, user: SessionUser) {
  const entry = await prisma.projectTimeEntry.findUnique({
    where: { id },
  });

  if (!entry) {
    throw new Error("Time entry not found");
  }

  if (user.role !== "ADMIN") {
    if (entry.userId !== user.id) {
      throw new Error("You can only delete your own time entries.");
    }
    const ageMs = Date.now() - new Date(entry.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      throw new Error("Time entries can only be deleted within 24 hours of creation.");
    }
  }

  return prisma.projectTimeEntry.delete({ where: { id } });
}

export async function getProjectTimerStatus(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      timeEntries: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const metrics = computeProjectTimerMetrics(project);

  return {
    projectId,
    status: metrics.timerStatus,
    activeTimer: metrics.activeTimer,
    totalDurationSeconds: metrics.totalDurationSeconds,
    serverTime: new Date().toISOString(),
  };
}

export async function listProjectTimeEntries(projectId: string, user?: SessionUser) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assignments: { select: { employeeId: true } },
    },
  });

  if (!project) throw new Error("Project not found");

  if (user && !canAccessProject(user, project)) {
    if (user.role === "CLIENT") {
      throw new Error("Project not found");
    }
    throw new Error("You do not have access to this project.");
  }

  const entries = await prisma.projectTimeEntry.findMany({
    where: { projectId, ...(user?.role === "CLIENT" ? { approvedAt: { not: null } } : {}) },
    orderBy: { startedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true } },
    },
  });

  // Client gets redacted shape (Spec 4.5 & 5)
  if (user?.role === "CLIENT") {
    return entries.map((e) => ({
      id: e.id,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      durationSeconds: e.durationSeconds,
      status: e.status,
      taskDescription: e.taskDescription || e.notes || (e.task?.title ?? "General work"),
      user: e.user ? { name: e.user.name } : null,
    }));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Time approval (clients only see approved time)
// ---------------------------------------------------------------------------

function assertCanApproveTime(user: SessionUser) {
  if (user.role !== "ADMIN") throw new Error("Only an admin can approve time entries.");
}

export async function approveTimeEntry(id: string, user: SessionUser) {
  assertCanApproveTime(user);
  const entry = await prisma.projectTimeEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Time entry not found");
  if (!entry.endedAt || entry.status === "RUNNING") {
    throw new Error("Stop the timer before approving this entry.");
  }

  const updated = await prisma.projectTimeEntry.update({
    where: { id },
    data: { approvedAt: new Date(), approvedById: user.id },
  });

  logActivity({
    type: "TIME_ENTRY_APPROVED",
    message: `Time entry approved (${entry.durationSeconds}s).`,
    entityType: "project",
    entityId: entry.projectId,
    projectId: entry.projectId,
    userId: user.id,
  }).catch(() => {});

  return updated;
}

export async function unapproveTimeEntry(id: string, user: SessionUser) {
  assertCanApproveTime(user);
  const entry = await prisma.projectTimeEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Time entry not found");

  return prisma.projectTimeEntry.update({
    where: { id },
    data: { approvedAt: null, approvedById: null },
  });
}

export async function approveAllCompletedEntries(projectId: string, user: SessionUser) {
  assertCanApproveTime(user);
  const result = await prisma.projectTimeEntry.updateMany({
    where: { projectId, endedAt: { not: null }, approvedAt: null, status: { not: "RUNNING" } },
    data: { approvedAt: new Date(), approvedById: user.id },
  });

  if (result.count > 0) {
    logActivity({
      type: "TIME_ENTRY_APPROVED",
      message: `${result.count} time entr${result.count === 1 ? "y" : "ies"} approved.`,
      entityType: "project",
      entityId: projectId,
      projectId,
      userId: user.id,
    }).catch(() => {});
  }

  return result.count;
}
