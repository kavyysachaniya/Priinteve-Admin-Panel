import { app } from "electron";
import { appendFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";

const MAX_BYTES = 1024 * 1024;

function logFile(): string {
  return path.join(app.getPath("userData"), "companion.log");
}

/** Append one line to the local log. Never pass tokens, email content or other secrets. */
export function log(level: "info" | "warn" | "error", message: string): void {
  const line = `${new Date().toISOString()} [${level}] ${message}\n`;
  try {
    const file = logFile();
    try {
      if (statSync(file).size > MAX_BYTES) renameSync(file, `${file}.1`);
    } catch {
      // No log yet.
    }
    appendFileSync(file, line);
  } catch {
    // Logging must never take the app down.
  }
  if (!app.isPackaged) console[level === "info" ? "log" : level](line.trimEnd());
}

export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
