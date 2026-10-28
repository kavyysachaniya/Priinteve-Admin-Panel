// Timer contract shared with the panel (`GET /api/companion/timer`, `POST /api/companion/timer/ops`).
// Keep in sync with lib/services/companion/timer.ts and lib/validations/companion-timer.ts.

const ID = /^[A-Za-z0-9_-]{1,40}$/;

export interface ServerSession {
  entryId: string;
  sessionId: string;
  status: "RUNNING" | "PAUSED";
  projectId: string;
  projectName: string;
  projectCode: string | null;
  taskId: string | null;
  taskTitle: string | null;
  taskDescription: string;
  sessionStartedAt: string;
  segmentStartedAt: string;
  pausedAt: string | null;
  /** Worked seconds in the session's finished segments (paused gaps excluded). */
  closedSeconds: number;
  /** When a desktop app last confirmed it was alive while this ran; null if none ever did. */
  lastHeartbeatAt: string | null;
}

export interface PickerProject {
  id: string;
  name: string;
  code: string | null;
  tasks: Array<{ id: string; title: string; status: string }>;
}

export interface ServerTimerState {
  session: ServerSession | null;
  projects: PickerProject[];
  canCreateTasks: boolean;
  serverTime: string;
}

export type TimerOpType = "START" | "PAUSE" | "RESUME" | "STOP";
export type StopReason = "USER" | "SWITCH" | "SHUTDOWN" | "RECOVERY";

/** One journaled action. `occurredAt` is server time as the app estimated it at the click. */
export interface TimerOp {
  opId: string;
  type: TimerOpType;
  occurredAt: string;
  projectId?: string;
  taskId?: string;
  newTaskTitle?: string;
  /** Shown in the UI while the op is pending (the server has the real names). */
  projectName?: string;
  taskTitle?: string;
  entryId?: string;
  sessionId?: string;
  stopReason?: StopReason;
  note?: string;
}

export interface OpResult {
  opId: string;
  status: "APPLIED" | "CONFLICT" | "REJECTED";
  message: string;
}

function str(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}

function iso(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function id(value: unknown): string | null {
  return typeof value === "string" && ID.test(value) ? value : null;
}

export function parseSession(input: unknown): ServerSession | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const entryId = id(r.entryId);
  const projectId = id(r.projectId);
  const sessionStartedAt = iso(r.sessionStartedAt);
  const segmentStartedAt = iso(r.segmentStartedAt);
  if (!entryId || !projectId || !sessionStartedAt || !segmentStartedAt) return null;
  if (r.status !== "RUNNING" && r.status !== "PAUSED") return null;
  return {
    entryId,
    sessionId: id(r.sessionId) ?? entryId,
    status: r.status,
    projectId,
    projectName: str(r.projectName, 120) ?? "Project",
    projectCode: str(r.projectCode, 20),
    taskId: id(r.taskId),
    taskTitle: str(r.taskTitle, 200),
    taskDescription: str(r.taskDescription, 300) ?? "",
    sessionStartedAt,
    segmentStartedAt,
    pausedAt: iso(r.pausedAt),
    closedSeconds: typeof r.closedSeconds === "number" && r.closedSeconds >= 0 ? Math.floor(r.closedSeconds) : 0,
    lastHeartbeatAt: iso(r.lastHeartbeatAt),
  };
}

export function parseTimerState(input: unknown): ServerTimerState | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const serverTime = iso(r.serverTime);
  if (!serverTime || !Array.isArray(r.projects)) return null;
  const projects: PickerProject[] = r.projects.slice(0, 100).flatMap((p): PickerProject[] => {
    if (!p || typeof p !== "object") return [];
    const o = p as Record<string, unknown>;
    const pid = id(o.id);
    if (!pid) return [];
    const tasks = Array.isArray(o.tasks) ? o.tasks : [];
    return [
      {
        id: pid,
        name: str(o.name, 120) ?? "Project",
        code: str(o.code, 20),
        tasks: tasks.slice(0, 50).flatMap((t) => {
          if (!t || typeof t !== "object") return [];
          const to = t as Record<string, unknown>;
          const tid = id(to.id);
          return tid ? [{ id: tid, title: str(to.title, 200) ?? "Task", status: str(to.status, 20) ?? "TODO" }] : [];
        }),
      },
    ];
  });
  return {
    session: r.session ? parseSession(r.session) : null,
    projects,
    canCreateTasks: r.canCreateTasks === true,
    serverTime,
  };
}

export function parseOpsResponse(input: unknown): { results: OpResult[]; state: ServerTimerState | null } | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (!Array.isArray(r.results)) return null;
  const results = r.results.flatMap((x): OpResult[] => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    if (typeof o.opId !== "string") return [];
    const status = o.status === "APPLIED" || o.status === "CONFLICT" || o.status === "REJECTED" ? o.status : "REJECTED";
    return [{ opId: o.opId, status, message: str(o.message, 300) ?? "" }];
  });
  return { results, state: parseTimerState(r.state) };
}

// ---------------------------------------------------------------------------
// What the window shows. Built only in the main process; the window and the tray both read it.
// ---------------------------------------------------------------------------

export type SyncState = "synced" | "pending" | "offline" | "signed-out" | "unpaired";

export interface TimerView {
  status: "IDLE" | "RUNNING" | "PAUSED";
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  /** Epoch ms (server clock) when the session started / the current segment started. */
  sessionStartedAtMs: number | null;
  segmentStartedAtMs: number | null;
  closedSeconds: number;
  /** Add to `Date.now()` in the window to get the server's clock. */
  clockOffsetMs: number;
  /** True while the local state includes ops the server hasn't confirmed yet. */
  unconfirmed: boolean;
  sync: SyncState;
  pendingOps: number;
  lastSyncedAt: string | null;
  projects: PickerProject[];
  canCreateTasks: boolean;
  /** Problems the person should look at (conflicts, rejected offline actions). */
  notices: Array<{ id: string; message: string }>;
}

/** Worked seconds right now, from timestamps only. */
export function workedSeconds(view: Pick<TimerView, "status" | "closedSeconds" | "segmentStartedAtMs">, serverNowMs: number): number {
  if (view.status !== "RUNNING" || view.segmentStartedAtMs === null) return view.closedSeconds;
  return view.closedSeconds + Math.max(0, Math.floor((serverNowMs - view.segmentStartedAtMs) / 1000));
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
