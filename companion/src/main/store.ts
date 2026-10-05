import { app, safeStorage } from "electron";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { log, describeError } from "./log";
import { parseBriefing, type Briefing } from "../shared/briefing";

// Small JSON files in %APPDATA%/Priinteve Companion. Writes go through a temp file + rename
// so a power cut mid-write can't leave a half-written file behind.

function file(name: string): string {
  return path.join(app.getPath("userData"), name);
}

function readJson<T>(name: string): Partial<T> {
  try {
    return JSON.parse(readFileSync(file(name), "utf8")) as Partial<T>;
  } catch {
    return {};
  }
}

function writeJson(name: string, data: unknown): void {
  try {
    const target = file(name);
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, target);
  } catch (err) {
    log("error", `Could not write ${name}: ${describeError(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Connection config (server URL + device token)
// ---------------------------------------------------------------------------

interface ConfigFile {
  serverUrl: string;
  /** Device token encrypted with Windows DPAPI via Electron safeStorage, base64. */
  encToken: string;
  autostartInitialized: boolean;
}

export interface ConnectionConfig {
  serverUrl: string;
  token: string;
}

export function getConnection(): ConnectionConfig | null {
  const cfg = readJson<ConfigFile>("config.json");
  if (!cfg.serverUrl || !cfg.encToken) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const token = safeStorage.decryptString(Buffer.from(cfg.encToken, "base64"));
    return { serverUrl: cfg.serverUrl, token };
  } catch (err) {
    log("warn", `Stored device token could not be decrypted: ${describeError(err)}`);
    return null;
  }
}

export function getServerUrl(): string {
  return readJson<ConfigFile>("config.json").serverUrl ?? "";
}

export function hasToken(): boolean {
  return Boolean(readJson<ConfigFile>("config.json").encToken);
}

export function saveConnection(serverUrl: string, token: string | null): void {
  const cfg = readJson<ConfigFile>("config.json");
  const next: Partial<ConfigFile> = { ...cfg, serverUrl };
  if (token) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Windows secure storage is not available, so the token can't be saved safely.");
    }
    next.encToken = safeStorage.encryptString(token).toString("base64");
  }
  writeJson("config.json", next);
}

export function isAutostartInitialized(): boolean {
  return readJson<ConfigFile>("config.json").autostartInitialized === true;
}

export function markAutostartInitialized(): void {
  writeJson("config.json", { ...readJson<ConfigFile>("config.json"), autostartInitialized: true });
}

// ---------------------------------------------------------------------------
// Daily state + briefing cache
// ---------------------------------------------------------------------------

interface StateFile {
  lastShownDate: string;
  /** Local date the person pressed "Stop for today" on the project reminder. */
  stopRemindersDate: string;
  /** Tray checkbox: reminders paused until switched back on. */
  remindersPaused: boolean;
  /** Epoch ms before which the update prompt isn't shown again ("Later"). */
  updateSnoozeUntil: number;
  /** Mascot size chosen from the tray menu. */
  mascotSize: "small" | "medium" | "large";
  /** Where the person dragged the (open) window to. */
  windowPos: { x: number; y: number };
}

export type MascotSize = StateFile["mascotSize"];

function readState(): Partial<StateFile> {
  return readJson<StateFile>("state.json");
}

function patchState(patch: Partial<StateFile>): void {
  writeJson("state.json", { ...readState(), ...patch });
}

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function wasShownToday(): boolean {
  return readState().lastShownDate === localDateKey();
}

export function markShownToday(): void {
  patchState({ lastShownDate: localDateKey() });
}

export function areRemindersStoppedToday(): boolean {
  return readState().stopRemindersDate === localDateKey();
}

export function stopRemindersToday(): void {
  patchState({ stopRemindersDate: localDateKey() });
}

export function areRemindersPaused(): boolean {
  return readState().remindersPaused === true;
}

export function setRemindersPaused(paused: boolean): void {
  patchState({ remindersPaused: paused });
}

export function getMascotSize(): MascotSize {
  const size = readState().mascotSize;
  return size === "small" || size === "large" ? size : "medium";
}

export function setMascotSize(size: MascotSize): void {
  patchState({ mascotSize: size });
}

export function getWindowPos(): { x: number; y: number } | null {
  const pos = readState().windowPos;
  return pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? { x: pos.x, y: pos.y } : null;
}

export function setWindowPos(pos: { x: number; y: number }): void {
  patchState({ windowPos: { x: Math.round(pos.x), y: Math.round(pos.y) } });
}

export function getUpdateSnoozeUntil(): number {
  return readState().updateSnoozeUntil ?? 0;
}

export function snoozeUpdatePrompt(untilEpochMs: number): void {
  patchState({ updateSnoozeUntil: untilEpochMs });
}

export function readCachedBriefing(): Briefing | null {
  return parseBriefing(readJson<Briefing>("briefing-cache.json"));
}

export function writeCachedBriefing(briefing: Briefing): void {
  writeJson("briefing-cache.json", briefing);
}
