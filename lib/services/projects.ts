import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import type { ProjectFormValues } from "@/lib/validations/project";
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
  } | null;
  timerStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
};

export type ProjectDetail = Prisma.ProjectGetPayload<{
  include: {
    customer: { select: { id: true; name: true; email: true; phone: true } };
    assignedTo: { select: { id: true; name: true; email: true } };
    createdBy: { select: { id: true; name: true } };
    timeEntries: {
      include: {
        user: { select: { id: true; name: true; email: true } };
      };
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
  }>;
}) {
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
      totalDurationSeconds += currentSessionElapsed;
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
      }
    : null;

  return {
    totalDurationSeconds,
    activeTimer,
    timerStatus,
  };
}

export async function listProjects(params: ListProjectsParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;

  const where: Prisma.ProjectWhereInput = {
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(params.priority && params.priority !== "ALL" ? { priority: params.priority } : {}),
    ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
    ...(params.hasActiveTimer
      ? {
          timeEntries: {
            some: {
              status: "RUNNING",
            },
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
            { customer: { name: { contains: params.q, mode: "insensitive" } } },
            { assignedTo: { name: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {}),
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

  // Sorting by totalTime requires ranking every matching project by tracked duration before
  // paginating. Instead of pulling every project's full time-entry history into memory, compute
  // the ranking from DB-side aggregates (cheap: ids + summed durations + the small set of
  // currently-running entries) and only fetch full records for the one page we're returning.
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

    const projects = orderedRaw.map((p) => {
      const metrics = computeProjectTimerMetrics(p);
      return {
        ...p,
        ...metrics,
      };
    });

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
        timeEntries: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  const projects = projectsRaw.map((p) => {
    const metrics = computeProjectTimerMetrics(p);
    return {
      ...p,
      ...metrics,
    };
  });

  return {
    projects,
    total,
    page,
    pageSize,
  };
}

export async function getProjectById(id: string): Promise<ProjectDetail | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      timeEntries: {
        include: {
          user: { select: { id: true, name: true, email: true } },
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

  const metrics = computeProjectTimerMetrics(project);

  return {
    ...project,
    ...metrics,
  };
}

export async function getProjectStats() {
  const [totalProjects, inProgressProjects, completedProjects, notStartedProjects, onHoldProjects, trackedAgg, runningEntries] =
    await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: "IN_PROGRESS" } }),
      prisma.project.count({ where: { status: "COMPLETED" } }),
      prisma.project.count({ where: { status: "NOT_STARTED" } }),
      prisma.project.count({ where: { status: "ON_HOLD" } }),
      // Completed/paused durations are summed at the DB level rather than fetching every
      // historical time entry — only the (small) set of currently-running entries needs
      // to be pulled into memory to add their live elapsed time below.
      prisma.projectTimeEntry.aggregate({
        where: { status: { not: "RUNNING" } },
        _sum: { durationSeconds: true },
      }),
      prisma.projectTimeEntry.findMany({
        where: { status: "RUNNING" },
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
    },
  });

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
    include: { timeEntries: { where: { status: "RUNNING" } } },
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

  const activityType = values.status === "COMPLETED" && existing.status !== "COMPLETED"
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
// Timer Operations
// ---------------------------------------------------------------------------

export async function startProjectTimer(projectId: string, userId?: string, notes?: string) {
  let projectName = "";
  let customerId: string | null = null;

  const timeEntry = await prisma.$transaction(async (tx) => {
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
      throw new Error("Cannot start timer on a completed project. Please reopen the project first.");
    }

    // 1. Check if this project already has an active running timer
    const existingRunning = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        status: "RUNNING",
      },
    });

    if (existingRunning) {
      throw new Error("This project already has an active timer.");
    }

    // 2. Check if the current user already has another active timer on any project
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

    const now = new Date();

    // Create the timer session
    const entry = await tx.projectTimeEntry.create({
      data: {
        projectId,
        userId: userId || null,
        startedAt: now,
        status: "RUNNING",
        notes: notes?.trim() || null,
      },
    });

    // If project was NOT_STARTED, automatically transition it to IN_PROGRESS
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

  return timeEntry;
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

    return tx.projectTimeEntry.update({
      where: { id: runningEntry.id },
      data: {
        status: "PAUSED",
        endedAt: now,
        durationSeconds: elapsed,
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

    // Check project running timer
    const existingRunning = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        status: "RUNNING",
      },
    });

    if (existingRunning) {
      throw new Error("This project already has an active timer.");
    }

    // Check user active timer elsewhere
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

    const now = new Date();

    const entry = await tx.projectTimeEntry.create({
      data: {
        projectId,
        userId: userId || null,
        startedAt: now,
        status: "RUNNING",
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

export async function stopProjectTimer(projectId: string, userId?: string) {
  let projectName = "";
  let customerId: string | null = null;

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

    // 1. If there's an active running timer, complete it
    const runningEntry = await tx.projectTimeEntry.findFirst({
      where: {
        projectId,
        status: "RUNNING",
      },
      orderBy: { startedAt: "desc" },
    });

    if (runningEntry) {
      if (runningEntry.userId !== userId) {
        throw new Error("You can only control your own timer.");
      }
      const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(runningEntry.startedAt).getTime()) / 1000));
      await tx.projectTimeEntry.update({
        where: { id: runningEntry.id },
        data: {
          status: "COMPLETED",
          endedAt: now,
          durationSeconds: elapsed,
        },
      });
    }

    // 2. Mark any PAUSED entries as COMPLETED so that the cycle is finished
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

  return { success: true };
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

export async function listProjectTimeEntries(projectId: string) {
  return prisma.projectTimeEntry.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
