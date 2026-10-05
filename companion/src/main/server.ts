import { net } from "electron";
import { parseLive, parseReminder, parseUpdateInfo, type LivePayload, type ReminderPayload, type UpdateInfo } from "../shared/briefing";
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
