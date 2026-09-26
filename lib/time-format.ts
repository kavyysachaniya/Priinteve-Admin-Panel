import { format, parseISO } from "date-fns";

/**
 * Format total seconds into a human-readable duration, e.g. "18h 42m 35s" or "45s".
 */
export function formatDuration(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds));
  if (sec === 0) return "0s";

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remSec > 0 || parts.length === 0) parts.push(`${remSec}s`);

  return parts.join(" ");
}

/**
 * Format total seconds into a clock string "HH:MM:SS" or "MM:SS" if under 1 hour.
 */
export function formatTimerClock(seconds: number, forceHours = true): string {
  const sec = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0 || forceHours) {
    return `${pad(hours)}:${pad(minutes)}:${pad(remSec)}`;
  }
  return `${pad(minutes)}:${pad(remSec)}`;
}

/**
 * Format a Date or date string to "dd MMM yyyy, hh:mm a"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy, hh:mm a");
}

/**
 * Format a Date or date string to "dd MMM yyyy"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy");
}

/**
 * Format a Date or date string to "hh:mm a"
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (isNaN(d.getTime())) return "—";
  return format(d, "hh:mm a");
}
