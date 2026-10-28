import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import { createNotification } from "@/lib/services/notifications";
import {
  canAccessProject,
  getVisibleProjectsQuery,
} from "@/lib/auth/projects";
import type { SessionUser } from "@/lib/auth/session";
import type { ProjectFormValues, TimeEntryUpdateValues } from "@/lib/validations/project";
import { Prisma } from "@prisma/client";
import type { ProjectPriority, ProjectStatus, TimeEntryStatus } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";

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

export type TimerStatus = "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";

/** One running timer on a project. Several people can each run one on the same project. */
export interface ActiveTimerInfo {
  id: string;
  startedAt: Date;
  elapsedSeconds: number;
  userId: string | null;
  userName: string | null;
  taskDescription?: string | null;
  taskId?: string | null;
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
  activeTimer: ActiveTimerInfo | null;
  activeTimers: ActiveTimerInfo[];
  timerStatus: TimerStatus;
  myTimerStatus: TimerStatus;
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
  activeTimer: ActiveTimerInfo | null;
  activeTimers: ActiveTimerInfo[];
  timerStatus: TimerStatus;
  myTimerStatus: TimerStatus;
};

export type ProjectWithDetails = ProjectListItem;

/**
 * Calculates current project duration and active timer details based on server time.
 * `activeTimers` lists every running timer (newest first); `activeTimer` is the newest one.
 * `myTimerStatus` is the viewer's own timer state on the project.
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
}, options: { approvedOnly?: boolean; viewerId?: string } = {}) {
  const now = Date.now();
  let totalDurationSeconds = 0;
  const runningEntries: (typeof project.timeEntries)[0][] = [];
  let latestEntry: (typeof project.timeEntries)[0] | null = null;
  let myLatestEntry: (typeof project.timeEntries)[0] | null = null;

  for (const entry of project.timeEntries) {
    if (!latestEntry || new Date(entry.startedAt).getTime() > new Date(latestEntry.startedAt).getTime()) {
      latestEntry = entry;
    }
    if (
      options.viewerId &&
      entry.userId === options.viewerId &&
      (!myLatestEntry || new Date(entry.startedAt).getTime() > new Date(myLatestEntry.startedAt).getTime())
    ) {
      myLatestEntry = entry;
    }

    if (entry.status === "RUNNING") {
      runningEntries.push(entry);
      const startedTime = new Date(entry.startedAt).getTime();
      const currentSessionElapsed = Math.max(0, Math.floor((now - startedTime) / 1000));
      if (!options.approvedOnly) totalDurationSeconds += currentSessionElapsed;
    } else {
      totalDurationSeconds += entry.durationSeconds || 0;
    }
  }

  const statusOf = (running: boolean, latest: typeof latestEntry): TimerStatus => {
    if (project.status === "COMPLETED") return "COMPLETED";
    if (running) return "RUNNING";
    if (latest && latest.status === "PAUSED") return "PAUSED";
    return "IDLE";
  };

  const timerStatus = statusOf(runningEntries.length > 0, latestEntry);
  const myTimerStatus = statusOf(myLatestEntry?.status === "RUNNING", myLatestEntry);

  const activeTimers: ActiveTimerInfo[] = runningEntries
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .map((entry) => ({
      id: entry.id,
      startedAt: new Date(entry.startedAt),
      elapsedSeconds: Math.max(0, Math.floor((now - new Date(entry.startedAt).getTime()) / 1000)),
      userId: entry.userId ?? null,
      userName: entry.user?.name ?? null,
      taskDescription: entry.taskDescription || entry.notes || null,
      taskId: entry.taskId ?? null,
    }));

  return {
    totalDurationSeconds,
    activeTimer: activeTimers[0] ?? null,
    activeTimers,
    timerStatus,
    myTimerStatus,
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
  const metrics = computeProjectTimerMetrics(
    { ...project, timeEntries },
    { approvedOnly: user?.role === "CLIENT", viewerId: user?.id }
  );
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

/** Normalises an optional project code and rejects one already used by another project. */
async function uniqueProjectCode(raw: string | undefined, projectId?: string) {
  const code = raw?.trim().toUpperCase() || null;
  if (!code) return null;
  const clash = await prisma.project.findUnique({ where: { code }, select: { id: true } });
  if (clash && clash.id !== projectId) throw new Error(`Project code "${code}" is already used by another project.`);
  return code;
}

export async function createProject(values: ProjectFormValues, userId?: string) {
  const project = await prisma.project.create({
    data: {
      name: values.name.trim(),
      code: await uniqueProjectCode(values.code),
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
          stopReason: "PROJECT_COMPLETED",
        },
      });
    }
    // Complete any paused entries as well
    await prisma.projectTimeEntry.updateMany({
      where: { projectId: id, status: "PAUSED" },
      data: { status: "COMPLETED", stopReason: "PROJECT_COMPLETED" },
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
          data: { status: "COMPLETED", endedAt: now, durationSeconds: elapsed, stopReason: "AUTO_UNASSIGN" },
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
      code: await uniqueProjectCode(values.code, id),
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
            stopReason: "AUTO_UNASSIGN",
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
          stopReason: "AUTO_UNASSIGN",
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
//
// A work session is one start → (pause → resume)* → stop. Each running stretch is its own
// ProjectTimeEntry row ("segment"); segments of one session share `sessionId`. Paused time is
// the gap between segments, so it is never counted. Durations always come from stored
// timestamps; nothing here trusts a client-side counter.

/** Sessions longer than this are flagged for an admin to review. */
const LONG_SESSION_SECONDS = 43200; // 12 hours

export type TimerSource = "WEB" | "DESKTOP" | "DESKTOP_OFFLINE";
export type TimerStopReason =
  | "USER"
  | "SWITCH"
  | "SHUTDOWN"
  | "RECOVERY"
  | "AUTO_UNASSIGN"
  | "PROJECT_COMPLETED";

export interface TimerOpOptions {
  /**
   * When the action really happened (a desktop action queued while offline). Clamped so it is
   * never in the future and never before the segment it closes; defaults to now.
   */
  at?: Date;
  source?: TimerSource;
  /** Idempotency key for start/resume; a replay finds the segment already created. */
  clientOpId?: string;
  stopReason?: TimerStopReason;
}

export const TIMER_ALREADY_RUNNING_MESSAGE =
  "You already have a timer running. Stop it before starting another.";

// Serializable isolation makes "check nothing is running, then insert" safe against double
// clicks, two tabs and the desktop app racing each other. The partial unique index
// ProjectTimeEntry_one_active_per_user (prisma/sql/active-timer-index.sql) is the backstop.
const TIMER_TX_OPTIONS = {
  ...TX_OPTIONS,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};

function toTimerError(err: unknown): unknown {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002" && !String(err.meta?.target ?? "").includes("clientOpId")) {
      return new Error(TIMER_ALREADY_RUNNING_MESSAGE);
    }
    if (err.code === "P2034") {
      return new Error("Another timer change happened at the same moment. Please try again.");
    }
  }
  return err;
}

async function runTimerTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(fn, TIMER_TX_OPTIONS);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      try {
        return await prisma.$transaction(fn, TIMER_TX_OPTIONS);
      } catch (retryErr) {
        throw toTimerError(retryErr);
      }
    }
    throw toTimerError(err);
  }
}

/** The moment an action takes effect: `at` (if given), never in the future, never before `floor`. */
function effectiveTime(at: Date | undefined, floor?: Date | null): Date {
  const now = Date.now();
  let t = at ? Math.min(at.getTime(), now) : now;
  if (floor) t = Math.max(t, floor.getTime());
  return new Date(t);
}

function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
}

/** Ends a running segment at `end` with the given status. */
function closeSegment(
  tx: Prisma.TransactionClient,
  entry: { id: string; startedAt: Date },
  end: Date,
  status: "PAUSED" | "COMPLETED",
  extra: Prisma.ProjectTimeEntryUpdateInput = {}
) {
  const durationSeconds = secondsBetween(entry.startedAt, end);
  return tx.projectTimeEntry.update({
    where: { id: entry.id },
    data: {
      status,
      endedAt: end,
      durationSeconds,
      flaggedForReview: durationSeconds > LONG_SESSION_SECONDS,
      ...extra,
    },
  });
}

async function loadTimerUser(tx: Prisma.TransactionClient, userId?: string) {
  if (!userId) return null;
  return tx.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, email: true, customerId: true },
  });
}

function assertMayTrackOn(
  user: { id: string; role: string } | null,
  project: { assignedToId: string | null; assignments: Array<{ employeeId: string }> }
) {
  if (!user) return;
  if (user.role === "CLIENT") throw new Error("Clients cannot start timers.");
  if (user.role === "EMPLOYEE") {
    const isAssigned =
      project.assignments.some((a) => a.employeeId === user.id) || project.assignedToId === user.id;
    if (!isAssigned) throw new Error("You must be assigned to this project to start the timer.");
  }
}

export async function startProjectTimer(
  projectId: string,
  userId?: string,
  taskDescription?: string,
  taskId?: string | null,
  options?: { autoStopPrevious?: boolean } & TimerOpOptions
) {
  let projectName = "";
  let customerId: string | null = null;
  let autoStoppedProjectName: string | null = null;
  let replayed = false;

  const timeEntry = await runTimerTx(async (tx) => {
    if (options?.clientOpId) {
      const existing = await tx.projectTimeEntry.findUnique({ where: { clientOpId: options.clientOpId } });
      if (existing) {
        replayed = true;
        return existing;
      }
    }

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

    assertMayTrackOn(await loadTimerUser(tx, userId), project);

    if (taskId) {
      const task = await tx.task.findUnique({
        where: { id: taskId },
        select: { projectId: true, status: true },
      });
      if (!task || task.projectId !== projectId) {
        throw new Error("That task doesn't belong to this project.");
      }
      if (task.status === "COMPLETED" || task.status === "CANCELLED") {
        throw new Error("This task is already closed. Reopen it before tracking time.");
      }
    }

    let startFloor: Date | null = null;

    if (userId) {
      const userActiveTimer = await tx.projectTimeEntry.findFirst({
        where: { userId, status: "RUNNING" },
        include: { project: { select: { id: true, name: true } } },
      });

      if (userActiveTimer) {
        // If options.autoStopPrevious is NOT set (e.g. test scripts), enforce strict checks
        if (!options?.autoStopPrevious) {
          throw new Error(
            `You already have an active timer running on project "${userActiveTimer.project?.name || "another project"}". Please pause or stop it first.`
          );
        }
        // Auto-stop previous timer for user (Spec 4.4): switching tasks ends the old session first.
        autoStoppedProjectName = userActiveTimer.project?.name || "another project";
        const stopAt = effectiveTime(options.at, userActiveTimer.startedAt);
        await closeSegment(tx, userActiveTimer, stopAt, "COMPLETED", { stopReason: "SWITCH" });
        startFloor = stopAt;
      }

      // A new session closes any paused session the user left behind.
      await tx.projectTimeEntry.updateMany({
        where: { userId, status: "PAUSED" },
        data: { status: "COMPLETED", stopReason: "SWITCH" },
      });
    }

    // Several people may run timers on the same project; each user still runs only one at a time.
    const id = createId();
    const finalDescription = taskDescription?.trim() || "Working on project";

    const entry = await tx.projectTimeEntry.create({
      data: {
        id,
        sessionId: id,
        projectId,
        userId: userId || null,
        startedAt: effectiveTime(options?.at, startFloor),
        status: "RUNNING",
        taskDescription: finalDescription,
        notes: finalDescription,
        taskId: taskId || null,
        source: options?.source ?? "WEB",
        clientOpId: options?.clientOpId ?? null,
      },
    });

    if (project.status === "NOT_STARTED") {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "IN_PROGRESS" },
      });
    }

    if (taskId) {
      await tx.task.updateMany({
        where: { id: taskId, status: "TODO" },
        data: { status: "IN_PROGRESS" },
      });
    }

    return entry;
  });

  if (!replayed) {
    logActivity({
      type: "TIMER_STARTED",
      message: `Timer started on project "${projectName}".`,
      entityType: "project",
      entityId: projectId,
      projectId,
      customerId,
      userId: userId || null,
    }).catch(() => {});
  }

  return Object.assign(timeEntry, { autoStoppedProjectName });
}

export async function pauseProjectTimer(projectId: string, userId?: string, options: TimerOpOptions = {}) {
  let projectName = "";
  let customerId: string | null = null;
  let elapsed = 0;
  let changed = false;

  const updated = await runTimerTx(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, customerId: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    projectName = project.name;
    customerId = project.customerId;

    // Pause is owner-only: it acts on the caller's own running timer on this project.
    const runningEntry = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        userId: userId ?? null,
        status: "RUNNING",
      },
      orderBy: { startedAt: "desc" },
    });

    if (!runningEntry) {
      // Pausing twice (a retried request) returns the segment that is already paused.
      const paused = userId
        ? await tx.projectTimeEntry.findFirst({
            where: { projectId, userId, status: "PAUSED" },
            orderBy: { startedAt: "desc" },
          })
        : null;
      if (paused) return paused;
      const othersRunning = await tx.projectTimeEntry.count({ where: { projectId, status: "RUNNING" } });
      if (othersRunning > 0) {
        throw new Error("You can only control your own timer.");
      }
      throw new Error("No active running timer found for this project.");
    }

    const end = effectiveTime(options.at, runningEntry.startedAt);
    elapsed = secondsBetween(runningEntry.startedAt, end);
    changed = true;
    return closeSegment(tx, runningEntry, end, "PAUSED");
  });

  if (changed) {
    logActivity({
      type: "TIMER_PAUSED",
      message: `Timer paused on project "${projectName}". Recorded session: ${elapsed}s.`,
      entityType: "project",
      entityId: projectId,
      projectId,
      customerId,
      userId: userId || null,
    }).catch(() => {});
  }

  return updated;
}

export async function resumeProjectTimer(projectId: string, userId?: string, options: TimerOpOptions = {}) {
  let projectName = "";
  let customerId: string | null = null;
  let replayed = false;

  const resumedEntry = await runTimerTx(async (tx) => {
    if (options.clientOpId) {
      const existing = await tx.projectTimeEntry.findUnique({ where: { clientOpId: options.clientOpId } });
      if (existing) {
        replayed = true;
        return existing;
      }
    }

    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { assignments: { select: { employeeId: true } } },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    projectName = project.name;
    customerId = project.customerId;

    if (project.status === "COMPLETED") {
      throw new Error("Cannot resume timer on a completed project.");
    }

    assertMayTrackOn(await loadTimerUser(tx, userId), project);

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
        // Resuming twice (a retried request) returns the segment that is already running.
        if (userActiveTimer.projectId === projectId) {
          replayed = true;
          return userActiveTimer;
        }
        throw new Error(
          `You already have an active timer running on project "${userActiveTimer.project?.name || "another project"}". Please pause or stop it first.`
        );
      }
    }

    // Only your own paused segment can be resumed; it carries the task and session forward.
    const paused = await tx.projectTimeEntry.findFirst({
      where: { projectId, userId: userId ?? null, status: "PAUSED" },
      orderBy: { startedAt: "desc" },
    });

    if (!paused) {
      throw new Error("There is no paused timer of yours on this project to resume.");
    }

    await tx.projectTimeEntry.update({
      where: { id: paused.id },
      data: { status: "COMPLETED" },
    });

    const entry = await tx.projectTimeEntry.create({
      data: {
        projectId,
        userId: userId || null,
        sessionId: paused.sessionId ?? paused.id,
        startedAt: effectiveTime(options.at, paused.endedAt),
        status: "RUNNING",
        taskDescription: paused.taskDescription || "Resumed project work",
        notes: paused.notes || "Resumed project work",
        taskId: paused.taskId || null,
        source: options.source ?? "WEB",
        clientOpId: options.clientOpId ?? null,
      },
    });

    if (project.status === "NOT_STARTED" || project.status === "ON_HOLD") {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "IN_PROGRESS" },
      });
    }

    return entry;
  });

  if (!replayed) {
    logActivity({
      type: "TIMER_RESUMED",
      message: `Timer resumed on project "${projectName}".`,
      entityType: "project",
      entityId: projectId,
      projectId,
      customerId,
      userId: userId || null,
    }).catch(() => {});
  }

  return resumedEntry;
}

/**
 * Stops a timer on the project. By default the caller's own; an admin may pass `forUserId` to stop
 * someone else's. Without `forUserId`, an admin who has no timer here stops the one other running
 * timer, if there is exactly one.
 */
export async function stopProjectTimer(
  projectId: string,
  userId?: string,
  taskDescription?: string,
  options: TimerOpOptions & { forUserId?: string } = {}
) {
  let projectName = "";
  let customerId: string | null = null;
  let elapsed = 0;
  let stoppedEntryId: string | null = null;
  let changed = false;

  await runTimerTx(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, customerId: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    projectName = project.name;
    customerId = project.customerId;

    // Whose session is being stopped: the caller's, or (admin override) someone else's.
    let ownerId = options.forUserId ?? userId ?? null;

    const callerIsAdmin = async () => {
      if (!userId) return false;
      const caller = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
      return caller?.role === "ADMIN";
    };

    if (options.forUserId && options.forUserId !== userId && !(await callerIsAdmin())) {
      throw new Error("You can only control your own timer.");
    }

    let runningEntry = await tx.projectTimeEntry.findFirst({
      where: { projectId, userId: ownerId, status: "RUNNING" },
      orderBy: { startedAt: "desc" },
    });

    if (!runningEntry && !options.forUserId) {
      const others = await tx.projectTimeEntry.findMany({
        where: { projectId, status: "RUNNING", userId: { not: null } },
        orderBy: { startedAt: "desc" },
        take: 2,
      });
      // With no own paused session to close, a stop aimed at someone else's timer needs admin rights.
      const ownPaused = await tx.projectTimeEntry.count({
        where: { projectId, userId: ownerId, status: "PAUSED" },
      });
      if (others.length > 0 && ownPaused === 0) {
        if (!(await callerIsAdmin())) {
          throw new Error("You can only control your own timer.");
        }
        if (others.length > 1) {
          throw new Error("Several people have timers running on this project. Choose whose timer to stop on the project's Timer tab.");
        }
        runningEntry = others[0];
        ownerId = runningEntry.userId;
      }
    }

    if (runningEntry) {
      const end = effectiveTime(options.at, runningEntry.startedAt);
      elapsed = secondsBetween(runningEntry.startedAt, end);
      stoppedEntryId = runningEntry.id;
      changed = true;

      await closeSegment(tx, runningEntry, end, "COMPLETED", {
        stopReason: options.stopReason ?? "USER",
        ...(taskDescription ? { taskDescription, notes: taskDescription } : {}),
      });
    }

    // Close the owner's paused segments on this project; other people's sessions are theirs.
    const closedPaused = await tx.projectTimeEntry.updateMany({
      where: {
        projectId,
        userId: ownerId,
        status: "PAUSED",
      },
      data: {
        status: "COMPLETED",
        stopReason: options.stopReason ?? "USER",
      },
    });
    if (closedPaused.count > 0) changed = true;
  });

  if (changed) {
    logActivity({
      type: "TIMER_STOPPED",
      message: `Timer stopped on project "${projectName}".`,
      entityType: "project",
      entityId: projectId,
      projectId,
      customerId,
      userId: userId || null,
    }).catch(() => {});
  }

  return { success: true, elapsedSeconds: elapsed, entryId: stoppedEntryId };
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
    serverTime: new Date(now).toISOString(),
  };
}

const OPEN_SEGMENT_INCLUDE = {
  project: { select: { id: true, name: true, code: true } },
  task: { select: { id: true, title: true } },
} satisfies Prisma.ProjectTimeEntryInclude;

/** The user's running segment, or else their most recent paused one. */
async function findOpenSegment(userId: string) {
  const running = await prisma.projectTimeEntry.findFirst({
    where: { userId, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    include: OPEN_SEGMENT_INCLUDE,
  });
  if (running) return running;
  return prisma.projectTimeEntry.findFirst({
    where: { userId, status: "PAUSED" },
    orderBy: { startedAt: "desc" },
    include: OPEN_SEGMENT_INCLUDE,
  });
}

/**
 * The user's open work session (running or paused), with totals over all of its segments.
 * Used by the desktop app; `workedSeconds` excludes paused gaps.
 */
export async function getActiveSessionForUser(userId: string) {
  const current = await findOpenSegment(userId);
  if (!current) return null;
  const sessionId = current.sessionId ?? current.id;

  const segments = await prisma.projectTimeEntry.findMany({
    where: { OR: [{ sessionId }, { id: sessionId }], userId },
    select: { id: true, startedAt: true, endedAt: true, durationSeconds: true, status: true },
    orderBy: { startedAt: "asc" },
  });

  const now = new Date();
  let closedSeconds = 0;
  for (const s of segments) {
    if (s.status !== "RUNNING") closedSeconds += s.durationSeconds || 0;
  }

  return {
    entryId: current.id,
    sessionId,
    status: current.status as "RUNNING" | "PAUSED",
    projectId: current.projectId,
    projectName: current.project.name,
    projectCode: current.project.code,
    taskId: current.taskId,
    taskTitle: current.task?.title || null,
    taskDescription: current.taskDescription || current.notes || "Working on project",
    sessionStartedAt: (segments[0]?.startedAt ?? current.startedAt).toISOString(),
    segmentStartedAt: current.startedAt.toISOString(),
    pausedAt: current.status === "PAUSED" ? current.endedAt?.toISOString() ?? null : null,
    closedSeconds,
    lastHeartbeatAt: current.lastHeartbeatAt?.toISOString() ?? null,
    serverTime: now.toISOString(),
  };
}

/** Records that the desktop app is alive while the user's timer runs (throttled to once a minute). */
export async function recordTimerHeartbeat(userId: string) {
  const cutoff = new Date(Date.now() - 60_000);
  await prisma.projectTimeEntry.updateMany({
    where: {
      userId,
      status: "RUNNING",
      OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: cutoff } }],
    },
    data: { lastHeartbeatAt: new Date() },
  });
}

export async function stopActiveTimerForUser(
  userId: string,
  taskDescription?: string,
  options: TimerOpOptions = {}
) {
  const activeEntry = await findOpenSegment(userId);

  if (!activeEntry) {
    throw new Error("No active running timer found.");
  }

  return stopProjectTimer(activeEntry.projectId, userId, taskDescription, options);
}

// ---------------------------------------------------------------------------
// Time Entry Corrections (Spec 4.4)
// ---------------------------------------------------------------------------
//
// Every edit or delete writes a TimeEntryCorrection with the values before the change, who made
// it and why, in the same transaction. History is never overwritten silently.

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function entrySnapshot(entry: {
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
  status: string;
  taskDescription: string | null;
  taskId: string | null;
  userId: string | null;
  approvedAt: Date | null;
}) {
  return {
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() ?? null,
    durationSeconds: entry.durationSeconds,
    status: entry.status,
    taskDescription: entry.taskDescription,
    taskId: entry.taskId,
    userId: entry.userId,
    approvedAt: entry.approvedAt?.toISOString() ?? null,
  };
}

function assertMayCorrect(entry: { userId: string | null; createdAt: Date }, user: SessionUser, verb: string) {
  // Spec 4.4: Admin can edit any time entry. Employees can edit only their own entries within 24 hours.
  if (user.role === "ADMIN") return;
  if (entry.userId !== user.id) {
    throw new Error(`You can only ${verb} your own time entries.`);
  }
  if (Date.now() - new Date(entry.createdAt).getTime() > EDIT_WINDOW_MS) {
    throw new Error(`Time entries can only be ${verb === "edit" ? "edited" : "deleted"} within 24 hours of creation.`);
  }
}

export async function updateTimeEntry(
  id: string,
  values: TimeEntryUpdateValues,
  user: SessionUser
) {
  const updated = await prisma.$transaction(async (tx) => {
    const entry = await tx.projectTimeEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new Error("Time entry not found");
    }

    assertMayCorrect(entry, user, "edit");

    const startedAt = values.startedAt ? new Date(values.startedAt) : entry.startedAt;
    const endedAt = values.endedAt ? new Date(values.endedAt) : entry.endedAt;

    if (Number.isNaN(startedAt.getTime()) || (endedAt && Number.isNaN(endedAt.getTime()))) {
      throw new Error("Enter a valid date and time.");
    }
    if (startedAt.getTime() > Date.now() || (endedAt && endedAt.getTime() > Date.now())) {
      throw new Error("Time entries can't be in the future.");
    }
    if (endedAt && endedAt.getTime() < startedAt.getTime()) {
      throw new Error("End time must be after start time.");
    }

    // Giving a running or paused segment an end time closes it.
    const status = endedAt && entry.status === "RUNNING" ? "COMPLETED" : entry.status;
    // Recompute only when the times change, so a description fix never alters recorded time.
    const timesChanged =
      startedAt.getTime() !== entry.startedAt.getTime() ||
      (endedAt?.getTime() ?? null) !== (entry.endedAt?.getTime() ?? null);
    const durationSeconds = !endedAt
      ? 0
      : timesChanged || status !== entry.status
        ? secondsBetween(startedAt, endedAt)
        : entry.durationSeconds;

    // Overlapping check for this user (a running segment counts up to now).
    if (entry.userId) {
      const effectiveEnd = endedAt ?? new Date();
      const overlap = await tx.projectTimeEntry.findFirst({
        where: {
          id: { not: id },
          userId: entry.userId,
          startedAt: { lt: effectiveEnd },
          OR: [{ endedAt: { gt: startedAt } }, { endedAt: null }],
        },
      });

      if (overlap) {
        throw new Error("This time period overlaps with another recorded time entry.");
      }
    }

    const next = await tx.projectTimeEntry.update({
      where: { id },
      data: {
        startedAt,
        endedAt,
        durationSeconds,
        status,
        ...(status !== entry.status && status === "COMPLETED" ? { stopReason: entry.stopReason ?? "USER" } : {}),
        flaggedForReview: durationSeconds > LONG_SESSION_SECONDS,
        approvedAt: null,
        approvedById: null,
        ...(values.taskDescription ? { taskDescription: values.taskDescription, notes: values.taskDescription } : {}),
      },
    });

    await tx.timeEntryCorrection.create({
      data: {
        entryId: id,
        projectId: entry.projectId,
        action: "EDIT",
        reason: values.reason,
        before: entrySnapshot(entry),
        after: entrySnapshot(next),
        changedById: user.id,
      },
    });

    return next;
  }, TX_OPTIONS);

  logActivity({
    type: "TIME_ENTRY_EDITED",
    message: `Time entry corrected: ${values.reason}`,
    entityType: "project",
    entityId: updated.projectId,
    projectId: updated.projectId,
    userId: user.id,
  }).catch(() => {});

  return updated;
}

export async function deleteTimeEntry(id: string, user: SessionUser, reason: string) {
  const deleted = await prisma.$transaction(async (tx) => {
    const entry = await tx.projectTimeEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new Error("Time entry not found");
    }

    assertMayCorrect(entry, user, "delete");

    if (entry.status === "RUNNING") {
      throw new Error("Stop the timer before deleting this entry.");
    }

    await tx.timeEntryCorrection.create({
      data: {
        entryId: id, // set to null by the delete below; the snapshot keeps the values
        projectId: entry.projectId,
        action: "DELETE",
        reason,
        before: entrySnapshot(entry),
        changedById: user.id,
      },
    });

    return tx.projectTimeEntry.delete({ where: { id } });
  }, TX_OPTIONS);

  logActivity({
    type: "TIME_ENTRY_DELETED",
    message: `Time entry deleted (${deleted.durationSeconds}s): ${reason}`,
    entityType: "project",
    entityId: deleted.projectId,
    projectId: deleted.projectId,
    userId: user.id,
  }).catch(() => {});

  return deleted;
}

export async function listTimeEntryCorrections(entryId: string, user: SessionUser) {
  const entry = await prisma.projectTimeEntry.findUnique({
    where: { id: entryId },
    include: { project: { include: { assignments: { select: { employeeId: true } } } } },
  });
  if (!entry) throw new Error("Time entry not found");
  if (user.role === "CLIENT") throw new Error("Time entry not found");
  if (user.role !== "ADMIN" && entry.userId !== user.id) {
    throw new Error("You can only view the history of your own time entries.");
  }

  return prisma.timeEntryCorrection.findMany({
    where: { entryId },
    orderBy: { createdAt: "desc" },
    include: { changedBy: { select: { id: true, name: true } } },
  });
}

export async function getProjectTimerStatus(projectId: string, user: SessionUser) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assignments: { select: { employeeId: true } },
      timeEntries: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!project || !canAccessProject(user, project)) {
    throw new Error("Project not found");
  }

  const metrics = computeProjectTimerMetrics({
    ...project,
    timeEntries: visibleTimeEntries(project.timeEntries, user),
  }, { approvedOnly: user.role === "CLIENT", viewerId: user.id });

  // Clients see that someone is working, not who or on what.
  const forViewer = (t: ActiveTimerInfo) =>
    user.role === "CLIENT" ? { id: t.id, startedAt: t.startedAt, elapsedSeconds: t.elapsedSeconds } : t;

  return {
    projectId,
    status: metrics.timerStatus,
    myStatus: metrics.myTimerStatus,
    activeTimer: metrics.activeTimer ? forViewer(metrics.activeTimer) : null,
    activeTimers: metrics.activeTimers.map(forViewer),
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
