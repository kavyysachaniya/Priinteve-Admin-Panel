import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { ServerSession, ServerTimerState, StopReason, SyncState, TimerOp, TimerView } from "../shared/timer";
import { TimerJournal } from "./journal";
import { describeError, log } from "./log";
import type { TimerCallError } from "./server";

// The desktop timer. The server's stored timestamps are the record; this class only
// (1) journals every action durably before it is shown as done,
// (2) sends the journal to the server in order and drops what the server has answered,
// (3) shows the server's session plus any actions still waiting, on the server's clock.
// Elapsed time is always worked out from timestamps; there is no counter to drift.

const SYNC_INTERVAL_MS = 20_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
/** A heartbeat gap longer than this while the timer ran means the session was interrupted. */
const INTERRUPTED_AFTER_MS = 3 * 60_000;

export interface TimerDeps {
  dataDir: string;
  fetchState: () => Promise<{ ok: true; data: ServerTimerState } | { ok: false; error: TimerCallError }>;
  postOps: (
    ops: TimerOp[],
  ) => Promise<
    | { ok: true; data: { results: Array<{ opId: string; status: string; message: string }>; state: ServerTimerState | null } }
    | { ok: false; error: TimerCallError }
  >;
}

export interface Interruption {
  key: string;
  entryId: string;
  sessionId: string;
  projectName: string;
  taskTitle: string | null;
  startedAt: string;
  lastConfirmedAt: string;
  detectedAt: string;
}

interface CacheFile {
  state: ServerTimerState | null;
  /** Server clock minus this PC's clock at the last sync. */
  wallOffsetMs: number;
  lastSyncedAt: string | null;
  notices: Array<{ id: string; message: string }>;
  dismissedInterruptions: string[];
}

export type ActionInput =
  | { type: "START"; projectId: string; taskId?: string; newTaskTitle?: string }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP"; stopReason?: StopReason; at?: string; note?: string };

export interface ActionResult {
  ok: boolean;
  message: string;
}

interface Projection {
  status: "IDLE" | "RUNNING" | "PAUSED";
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  entryId: string | null;
  sessionId: string | null;
  sessionStartedAtMs: number | null;
  segmentStartedAtMs: number | null;
  closedSeconds: number;
}

const IDLE: Projection = {
  status: "IDLE",
  projectId: null,
  projectName: null,
  taskId: null,
  taskTitle: null,
  entryId: null,
  sessionId: null,
  sessionStartedAtMs: null,
  segmentStartedAtMs: null,
  closedSeconds: 0,
};

function fromSession(s: ServerSession | null): Projection {
  if (!s) return { ...IDLE };
  return {
    status: s.status,
    projectId: s.projectId,
    projectName: s.projectName,
    taskId: s.taskId,
    taskTitle: s.taskTitle ?? s.taskDescription,
    entryId: s.entryId,
    sessionId: s.sessionId,
    sessionStartedAtMs: Date.parse(s.sessionStartedAt),
    segmentStartedAtMs: s.status === "RUNNING" ? Date.parse(s.segmentStartedAt) : null,
    closedSeconds: s.closedSeconds,
  };
}

/** Applies one not-yet-confirmed action to the projected state (mirrors the server's rules). */
function applyOp(p: Projection, op: TimerOp): Projection {
  const at = Date.parse(op.occurredAt);
  const segment = (from: number | null) => (from === null ? 0 : Math.max(0, Math.floor((at - from) / 1000)));
  switch (op.type) {
    case "START":
      return {
        status: "RUNNING",
        projectId: op.projectId ?? null,
        projectName: op.projectName ?? null,
        taskId: op.taskId ?? null,
        taskTitle: op.taskTitle ?? op.newTaskTitle ?? null,
        entryId: null,
        sessionId: null,
        sessionStartedAtMs: at,
        segmentStartedAtMs: at,
        closedSeconds: 0,
      };
    case "PAUSE":
      if (p.status !== "RUNNING") return p;
      return { ...p, status: "PAUSED", closedSeconds: p.closedSeconds + segment(p.segmentStartedAtMs), segmentStartedAtMs: null };
    case "RESUME":
      if (p.status !== "PAUSED") return p;
      return { ...p, status: "RUNNING", segmentStartedAtMs: at };
    case "STOP":
      return { ...IDLE };
  }
}

export class TimerController {
  private readonly journal: TimerJournal;
  private readonly cacheFile: string;
  private cache: CacheFile;
  private sync: SyncState = "pending";
  private anchor = { serverMs: 0, monoMs: 0 };
  private flushing: Promise<void> | null = null;
  private loop: NodeJS.Timeout | null = null;
  private failures = 0;
  private readonly listeners = new Set<() => void>();
  private interruption: Interruption | null = null;
  private readonly interruptionListeners = new Set<(i: Interruption) => void>();

  constructor(private readonly deps: TimerDeps) {
    this.journal = new TimerJournal(path.join(deps.dataDir, "timer-journal.jsonl"));
    this.cacheFile = path.join(deps.dataDir, "timer-state.json");
    this.cache = this.readCache();
    this.reanchor();
    if (this.journal.pending().length > 0) log("info", `Timer journal has ${this.journal.pending().length} unsent action(s)`);
  }

  // -- clock ---------------------------------------------------------------

  /** The server's clock, advanced with a monotonic timer between syncs. */
  serverNow(): number {
    return this.anchor.serverMs + (performance.now() - this.anchor.monoMs);
  }

  /** After sleep or a clock change the monotonic anchor may be stale: restart it from the wall clock. */
  reanchor(): void {
    this.anchor = { serverMs: Date.now() + this.cache.wallOffsetMs, monoMs: performance.now() };
  }

  private adoptServerTime(serverTime: string): void {
    const serverMs = Date.parse(serverTime);
    if (Number.isNaN(serverMs)) return;
    this.anchor = { serverMs, monoMs: performance.now() };
    this.cache.wallOffsetMs = serverMs - Date.now();
  }

  // -- state ---------------------------------------------------------------

  private projection(): Projection {
    let p = fromSession(this.cache.state?.session ?? null);
    for (const op of this.journal.pending()) p = applyOp(p, op);
    return p;
  }

  isActive(): boolean {
    return this.projection().status !== "IDLE";
  }

  view(): TimerView {
    const p = this.projection();
    const pending = this.journal.pending().length;
    return {
      status: p.status,
      projectId: p.projectId,
      projectName: p.projectName,
      taskId: p.taskId,
      taskTitle: p.taskTitle,
      sessionStartedAtMs: p.sessionStartedAtMs,
      segmentStartedAtMs: p.segmentStartedAtMs,
      closedSeconds: p.closedSeconds,
      clockOffsetMs: Math.round(this.serverNow() - Date.now()),
      unconfirmed: pending > 0,
      sync: pending > 0 && this.sync === "synced" ? "pending" : this.sync,
      pendingOps: pending,
      lastSyncedAt: this.cache.lastSyncedAt,
      projects: this.cache.state?.projects ?? [],
      canCreateTasks: this.cache.state?.canCreateTasks ?? false,
      notices: this.cache.notices,
    };
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onInterruption(listener: (i: Interruption) => void): () => void {
    this.interruptionListeners.add(listener);
    return () => this.interruptionListeners.delete(listener);
  }

  currentInterruption(): Interruption | null {
    return this.interruption;
  }

  private emit(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        log("warn", `Timer listener failed: ${describeError(err)}`);
      }
    }
  }

  // -- actions -------------------------------------------------------------

  /**
   * Journals an action, then tries to send it. Resolves once the action is safely on disk
   * (`ok`), whether or not the server could be reached; the message says which.
   */
  async act(input: ActionInput): Promise<ActionResult> {
    const p = this.projection();
    const occurredAt = new Date(input.type === "STOP" && input.at ? Date.parse(input.at) : this.serverNow()).toISOString();
    const op: TimerOp = { opId: randomUUID(), type: input.type, occurredAt };

    if (input.type === "START") {
      const project = this.cache.state?.projects.find((x) => x.id === input.projectId);
      if (!project) return { ok: false, message: "Choose a project first." };
      const task = input.taskId ? project.tasks.find((t) => t.id === input.taskId) : undefined;
      if (input.taskId && !task) return { ok: false, message: "That task isn't available any more. Refresh and pick again." };
      if (!input.taskId && !input.newTaskTitle) return { ok: false, message: "Choose a task or type a new one." };
      Object.assign(op, {
        projectId: project.id,
        projectName: project.name,
        taskId: task?.id,
        taskTitle: task?.title,
        newTaskTitle: task ? undefined : input.newTaskTitle,
      });
    } else if (input.type === "PAUSE") {
      if (p.status !== "RUNNING") return { ok: false, message: "The timer isn't running." };
      if (p.entryId) op.entryId = p.entryId;
    } else if (input.type === "RESUME") {
      if (p.status !== "PAUSED" || !p.projectId) return { ok: false, message: "There's no paused timer to resume." };
      op.projectId = p.projectId;
    } else {
      if (p.status === "IDLE") return { ok: false, message: "The timer is already stopped." };
      if (p.sessionId) op.sessionId = p.sessionId;
      op.stopReason = input.stopReason ?? "USER";
      if (input.note) op.note = input.note;
    }

    try {
      this.journal.append(op);
    } catch (err) {
      log("error", `Could not write the timer journal: ${describeError(err)}`);
      return { ok: false, message: "This PC couldn't save the timer change to disk, so nothing was changed." };
    }
    this.emit();

    await this.flush();
    const stillPending = this.journal.pending().some((o) => o.opId === op.opId);
    if (!stillPending) {
      const notice = this.cache.notices.find((n) => n.id === op.opId);
      return notice ? { ok: false, message: notice.message } : { ok: true, message: "Saved." };
    }
    return {
      ok: true,
      message:
        this.sync === "signed-out"
          ? "Saved on this PC. It will sync once this computer is paired again."
          : "Saved on this PC. It will sync when the server is reachable.",
    };
  }

  dismissNotice(id: string): void {
    this.cache.notices = this.cache.notices.filter((n) => n.id !== id);
    this.writeCache();
    this.emit();
  }

  /** The person answered the interrupted-session prompt; don't ask again for the same gap. */
  dismissInterruption(key: string): void {
    if (!this.cache.dismissedInterruptions.includes(key)) {
      this.cache.dismissedInterruptions = [...this.cache.dismissedInterruptions.slice(-19), key];
      this.writeCache();
    }
    if (this.interruption?.key === key) this.interruption = null;
    this.emit();
  }

  // -- sync ----------------------------------------------------------------

  start(): void {
    if (this.loop) return;
    void this.flush();
    const schedule = (delay: number) => {
      this.loop = setTimeout(() => {
        void this.flush().finally(() => {
          const backoff = this.failures > 0 ? RETRY_DELAYS_MS[Math.min(this.failures - 1, RETRY_DELAYS_MS.length - 1)] : SYNC_INTERVAL_MS;
          schedule(backoff);
        });
      }, delay);
    };
    schedule(SYNC_INTERVAL_MS);
  }

  /** Sends pending actions (in order), then refreshes the server state. Never throws. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.doFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  /** Like flush, but gives up waiting after `ms` (the actions stay journaled either way). */
  async flushWithin(ms: number): Promise<boolean> {
    await Promise.race([this.flush(), new Promise((resolve) => setTimeout(resolve, ms))]);
    return this.journal.pending().length === 0 && this.sync === "synced";
  }

  private async doFlush(): Promise<void> {
    try {
      let pending = this.journal.pending();
      while (pending.length > 0) {
        const batch = pending.slice(0, 50);
        const res = await this.deps.postOps(batch);
        if (!res.ok) return this.fail(res.error);
        const answered: string[] = [];
        for (const r of res.data.results) {
          answered.push(r.opId);
          if (r.status !== "APPLIED") {
            log("warn", `Timer action ${r.opId} ${r.status}: ${r.message}`);
            this.cache.notices = [...this.cache.notices.slice(-9), { id: r.opId, message: r.message }];
          }
        }
        this.journal.ack(answered);
        if (res.data.state) this.adoptState(res.data.state);
        pending = this.journal.pending();
        if (answered.length === 0) break; // the server answered nothing; try again later
      }

      const state = await this.deps.fetchState();
      if (!state.ok) return this.fail(state.error);
      this.adoptState(state.data);
    } catch (err) {
      log("warn", `Timer sync failed: ${describeError(err)}`);
      this.fail("offline");
    }
  }

  private adoptState(state: ServerTimerState): void {
    this.adoptServerTime(state.serverTime);
    this.cache.state = state;
    this.cache.lastSyncedAt = new Date().toISOString();
    this.failures = 0;
    this.sync = "synced";
    this.writeCache();
    this.checkInterruption(state);
    this.emit();
  }

  private fail(error: TimerCallError): void {
    this.failures += 1;
    this.sync = error === "auth" ? "signed-out" : error === "unpaired" ? "unpaired" : "offline";
    this.emit();
  }

  private checkInterruption(state: ServerTimerState): void {
    const s = state.session;
    if (!s || s.status !== "RUNNING" || !s.lastHeartbeatAt) return;
    // The server sends the heartbeat from *before* this poll, so a gap means nobody was watching.
    const gap = Date.parse(state.serverTime) - Date.parse(s.lastHeartbeatAt);
    if (gap < INTERRUPTED_AFTER_MS) return;
    const key = `${s.entryId}@${s.lastHeartbeatAt}`;
    if (this.cache.dismissedInterruptions.includes(key) || this.interruption?.key === key) return;
    this.interruption = {
      key,
      entryId: s.entryId,
      sessionId: s.sessionId,
      projectName: s.projectName,
      taskTitle: s.taskTitle,
      startedAt: s.segmentStartedAt,
      lastConfirmedAt: s.lastHeartbeatAt,
      detectedAt: state.serverTime,
    };
    log("info", `Interrupted session detected on ${s.entryId} (gap ${Math.round(gap / 1000)} s)`);
    for (const l of this.interruptionListeners) l(this.interruption);
  }

  // -- cache ---------------------------------------------------------------

  private readCache(): CacheFile {
    try {
      const raw = JSON.parse(readFileSync(this.cacheFile, "utf8")) as Partial<CacheFile>;
      return {
        state: raw.state ?? null,
        wallOffsetMs: typeof raw.wallOffsetMs === "number" ? raw.wallOffsetMs : 0,
        lastSyncedAt: raw.lastSyncedAt ?? null,
        notices: Array.isArray(raw.notices) ? raw.notices.slice(-10) : [],
        dismissedInterruptions: Array.isArray(raw.dismissedInterruptions) ? raw.dismissedInterruptions.slice(-20) : [],
      };
    } catch {
      return { state: null, wallOffsetMs: 0, lastSyncedAt: null, notices: [], dismissedInterruptions: [] };
    }
  }

  private writeCache(): void {
    try {
      const tmp = `${this.cacheFile}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.cache));
      renameSync(tmp, this.cacheFile);
    } catch (err) {
      log("warn", `Could not write the timer cache: ${describeError(err)}`);
    }
  }
}
