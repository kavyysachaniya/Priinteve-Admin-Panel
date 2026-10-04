import type { Prisma, ProjectPriority, ProjectStatus, TaskStatus } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

export interface ProjectAccessCheckItem {
  id?: string;
  customerId?: string | null;
  assignedToId?: string | null;
  assignments?: Array<{ employeeId: string }>;
}

/**
 * Single central helper to determine if a user can access a specific project.
 * Rules:
 * - ADMIN: full access to all projects.
 * - EMPLOYEE: assigned projects only (via ProjectAssignment or legacy assignedToId).
 * - CLIENT: own projects only (where project.customerId === user.customerId).
 */
export function canAccessProject(
  user: SessionUser,
  project: ProjectAccessCheckItem
): boolean {
  if (user.role === "ADMIN") return true;

  if (user.role === "EMPLOYEE") {
    if (project.assignments?.some((a) => a.employeeId === user.id)) return true;
    if (project.assignedToId === user.id) return true;
    return false;
  }

  if (user.role === "CLIENT") {
    return Boolean(user.customerId && project.customerId === user.customerId);
  }

  return false;
}

/**
 * Returns Prisma Project where clause for projects visible to this user.
 */
export function getVisibleProjectsQuery(user: SessionUser): Prisma.ProjectWhereInput {
  if (user.role === "ADMIN") {
    return {};
  }

  if (user.role === "EMPLOYEE") {
    return {
      OR: [
        { assignments: { some: { employeeId: user.id } } },
        { assignedToId: user.id },
      ],
    };
  }

  if (user.role === "CLIENT") {
    if (!user.customerId) {
      // Client has no customer record linked -> no projects visible
      return { id: "__NO_CLIENT_ACCESS__" };
    }
    return {
      customerId: user.customerId,
    };
  }

  return { id: "__NO_ACCESS__" };
}

/**
 * Check if user can assign/unassign employees to a project.
 * Only ADMINs can manage assignments.
 */
export function canManageProjectAssignments(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

/**
 * Check if user can start a timer on a project.
 * Only ADMIN or EMPLOYEE assigned to the project can start timer.
 * CLIENT can never start timers.
 */
export function canStartTimerOnProject(
  user: SessionUser,
  project: ProjectAccessCheckItem
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "EMPLOYEE") {
    return canAccessProject(user, project);
  }
  return false;
}

/**
 * Redacted DTO for Client Role responses (Whitelisting only safe fields).
 * Hides internal notes, hourly rates, costs, margins, and private team info.
 */
export interface ClientProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  totalDurationSeconds: number;
  isSomeoneWorking: boolean;
  activeWorkers: Array<{
    employeeName: string;
    taskDescription: string;
    startedAt: string;
  }>;
  taskCounts: {
    total: number;
    todo: number;
    inProgress: number;
    completed: number;
  };
  progressPercentage: number;
  recentTimeEntries: Array<{
    id: string;
    date: string;
    employeeName: string;
    taskDescription: string;
    durationSeconds: number;
  }>;
  timePerTask: Array<{
    taskId: string | null;
    taskTitle: string;
    totalSeconds: number;
  }>;
}

export function toClientProjectDto(project: {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate?: Date | string | null;
  dueDate?: Date | string | null;
  tasks?: Array<{ id: string; status: TaskStatus }>;
  timeEntries?: Array<{
    id: string;
    startedAt: Date | string;
    endedAt: Date | string | null;
    durationSeconds: number;
    status: string;
    approvedAt?: Date | string | null;
    taskDescription?: string | null;
    notes?: string | null;
    taskId?: string | null;
    task?: { title: string } | null;
    user?: { name: string } | null;
  }>;
}): ClientProjectDto {
  const timeEntries = project.timeEntries || [];

  const now = Date.now();
  const activeWorkers: ClientProjectDto["activeWorkers"] = [];
  const taskMap = new Map<string, { title: string; totalSeconds: number }>();
  let totalDurationSeconds = 0;

  for (const entry of timeEntries) {
    const isRunning = entry.status === "RUNNING";
    const employeeName = entry.user?.name || "Team Member";
    const taskDesc = entry.taskDescription || entry.notes || (entry.task?.title ?? "General work");

    if (isRunning) {
      // Live indicator only: running time never counts toward client totals until approved.
      activeWorkers.push({
        employeeName,
        taskDescription: taskDesc,
        startedAt: new Date(entry.startedAt).toISOString(),
      });
      continue;
    }

    if (!entry.approvedAt) continue;
    const sessionSeconds = entry.durationSeconds || 0;

    totalDurationSeconds += sessionSeconds;

    const taskKey = entry.taskId || "__GENERAL__";
    const taskTitle = entry.task?.title || "General / Unassigned Task";
    const existingTask = taskMap.get(taskKey) || { title: taskTitle, totalSeconds: 0 };
    existingTask.totalSeconds += sessionSeconds;
    taskMap.set(taskKey, existingTask);
  }

  // Tasks aggregation
  const tasks = (project.tasks || []) as Array<{ id: string; status: string; title: string }>;
  let todo = 0;
  let inProgress = 0;
  let completed = 0;

  for (const t of tasks) {
    if (t.status === "COMPLETED") completed++;
    else if (t.status === "IN_PROGRESS") inProgress++;
    else if (t.status === "TODO") todo++;
  }
  const total = tasks.length;
  const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const recentTimeEntries = timeEntries
    .filter((e) => e.status !== "RUNNING" && e.endedAt && e.approvedAt)
    .slice(0, 20)
    .map((e) => ({
      id: e.id,
      date: new Date(e.startedAt).toISOString(),
      employeeName: e.user?.name || "Team Member",
      taskDescription: e.taskDescription || e.notes || (e.task?.title ?? "Project Work"),
      durationSeconds: e.durationSeconds,
    }));

  const timePerTask = Array.from(taskMap.entries()).map(([taskId, data]) => ({
    taskId: taskId === "__GENERAL__" ? null : taskId,
    taskTitle: data.title,
    totalSeconds: data.totalSeconds,
  }));

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    status: project.status,
    priority: project.priority,
    startDate: project.startDate ? new Date(project.startDate).toISOString() : null,
    dueDate: project.dueDate ? new Date(project.dueDate).toISOString() : null,
    totalDurationSeconds,
    isSomeoneWorking: activeWorkers.length > 0,
    activeWorkers,
    taskCounts: {
      total,
      todo,
      inProgress,
      completed,
    },
    progressPercentage,
    recentTimeEntries,
    timePerTask,
  };
}
