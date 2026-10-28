import { net } from "electron";
import { parseLive, parseReminder, parseUpdateInfo, type LivePayload, type ReminderPayload, type UpdateInfo } from "../shared/briefing";
import { parseOpsResponse, parseTimerState, type TimerOp } from "../shared/timer";
import { describeError, log } from "./log";
import { getConnection } from "./store";

// Small authenticated GETs against the panel (device token). Every function swallows its
// own errors and returns null: reminders and update checks must never disturb the user.

const TIMEOUT_MS = 15_000;

async function getJson(pathAndQuery: string): Promise<unknown | null> {
  const connection = getConnection();
  if (!connection) return null;
  try {
    const res = await net.fetch(new URL(pathAndQuery, connection.serverUrl).toString(), {
      headers: { Authorization: `Bearer ${connection.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
    if (!res.ok) {
      log("warn", `${pathAndQuery.split("?")[0]} answered HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    log("warn", `${pathAndQuery.split("?")[0]} failed: ${describeError(err)}`);
    return null;
  }
}

export async function fetchReminder(): Promise<ReminderPayload | null> {
  return parseReminder(await getJson("/api/companion/reminder"));
}

/** Returns the offered update, or null when none is available (or the check failed). */
export async function fetchUpdateInfo(currentVersion: string): Promise<UpdateInfo | null> {
  return parseUpdateInfo(await getJson(`/api/companion/update?current=${encodeURIComponent(currentVersion)}`));
}

/** The running timer and the status of the given tasks. Null when the check failed. */
export async function fetchLive(taskIds: string[]): Promise<LivePayload | null> {
  const query = taskIds.length ? `?tasks=${encodeURIComponent(taskIds.join(","))}` : "";
  return parseLive(await getJson(`/api/companion/live${query}`));
}

export interface TaskActionResult {
  ok: boolean;
  message: string;
}

/** Marks a task done or starts/stops a timer. Never throws; failures come back as a message. */
export async function postTaskAction(action: string, taskId: string): Promise<TaskActionResult> {
  const connection = getConnection();
  if (!connection) return { ok: false, message: "This computer isn't paired yet." };
  try {
    const res = await net.fetch(new URL("/api/companion/task", connection.serverUrl).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action, taskId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
    const data = (await res.json().catch(() => ({}))) as { message?: unknown; error?: unknown };
    if (res.ok) return { ok: true, message: typeof data.message === "string" ? data.message : "Done." };
    log("warn", `Task action ${action} answered HTTP ${res.status}`);
    return { ok: false, message: typeof data.error === "string" ? data.error : "That didn't work. Please try again." };
  } catch (err) {
    log("warn", `Task action ${action} failed: ${describeError(err)}`);
    return { ok: false, message: "Couldn't reach the server. Check your connection." };
  }
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

/** Why a timer call failed: no network/server, the token was revoked, or the server refused. */
export type TimerCallError = "offline" | "auth" | "server" | "unpaired";

type TimerCall<T> = { ok: true; data: T } | { ok: false; error: TimerCallError; status?: number };

async function timerCall<T>(pathname: string, parse: (input: unknown) => T | null, body?: unknown): Promise<TimerCall<T>> {
  const connection = getConnection();
  if (!connection) return { ok: false, error: "unpaired" };
  try {
    const res = await net.fetch(new URL(pathname, connection.serverUrl).toString(), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
    if (res.status === 401) return { ok: false, error: "auth", status: 401 };
    if (!res.ok) {
      log("warn", `${pathname} answered HTTP ${res.status}`);
      // 5xx and 429 are worth retrying later; other 4xx mean the request itself was refused.
      return { ok: false, error: res.status >= 500 || res.status === 429 ? "offline" : "server", status: res.status };
    }
    const data = parse(await res.json());
    if (data === null) return { ok: false, error: "server", status: res.status };
    return { ok: true, data };
  } catch (err) {
    log("warn", `${pathname} failed: ${describeError(err)}`);
    return { ok: false, error: "offline" };
  }
}

export function fetchTimerState() {
  return timerCall("/api/companion/timer", parseTimerState);
}

export function postTimerOps(ops: TimerOp[]) {
  // Only the fields the server reads; display-only names stay on this PC.
  const payload = ops.map(({ projectName: _p, taskTitle: _t, ...op }) => op);
  return timerCall("/api/companion/timer/ops", parseOpsResponse, { ops: payload });
}
