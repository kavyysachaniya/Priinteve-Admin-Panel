import type { BrowserWindow } from "electron";
import { describeError, log } from "./log";

// Windows shutdown/restart protection while a timer is open.
//
// Windows sends WM_QUERYENDSESSION to every top-level window before a shutdown, restart or
// sign-out. Electron surfaces it as the BrowserWindow `query-session-end` event; calling
// preventDefault() makes the window refuse, and Windows then shows its "These apps are
// preventing shutdown" screen. ShutdownBlockReasonCreate (user32) sets the text Windows shows
// for this app on that screen; without it Windows shows only the app name.
//
// Limits (documented in docs/COMPANION.md): a forced shutdown (`shutdown /f`, "Shut down
// anyway", a critical battery), power loss or killing the process can't be blocked. Those are
// handled by the interrupted-session recovery on the next start, never by inventing a stop time.

export const BLOCK_REASON =
  "Your Priinteve timer is still running. Stop your active task timer before shutting down this PC.";

type BlockFns = {
  create: (hwnd: bigint, reason: string) => boolean;
  destroy: (hwnd: bigint) => boolean;
};

let fns: BlockFns | null | undefined;

function load(): BlockFns | null {
  if (fns !== undefined) return fns;
  fns = null;
  if (process.platform !== "win32") return fns;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require("koffi") as typeof import("koffi");
    const user32 = koffi.load("user32.dll");
    const create = user32.func("bool __stdcall ShutdownBlockReasonCreate(intptr_t hWnd, str16 pwszReason)");
    const destroy = user32.func("bool __stdcall ShutdownBlockReasonDestroy(intptr_t hWnd)");
    fns = {
      create: (hwnd, reason) => Boolean(create(hwnd, reason)),
      destroy: (hwnd) => Boolean(destroy(hwnd)),
    };
  } catch (err) {
    log("warn", `Shutdown block reason unavailable (Windows will show only the app name): ${describeError(err)}`);
  }
  return fns;
}

function hwndOf(win: BrowserWindow): bigint {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0));
}

let blockedOn: bigint | null = null;

/** Shows (or clears, with `null`) this app's reason on Windows' shutdown-blocked screen. */
export function setShutdownBlockReason(win: BrowserWindow, reason: string | null): void {
  const api = load();
  if (!api || win.isDestroyed()) return;
  try {
    const hwnd = hwndOf(win);
    if (reason) {
      if (api.create(hwnd, reason)) blockedOn = hwnd;
      else log("warn", "ShutdownBlockReasonCreate returned false");
    } else if (blockedOn !== null) {
      api.destroy(blockedOn);
      blockedOn = null;
    }
  } catch (err) {
    log("warn", `Could not update the shutdown block reason: ${describeError(err)}`);
  }
}

export interface ShutdownGuardDeps {
  /** True while a timer session is open (running or paused). */
  isActive: () => boolean;
  /** Bring the window up with the "stop your timer first" prompt. Called once per request. */
  prompt: (reasons: string[]) => void;
  /** The session really ended (the person forced it): the journal is already on disk. */
  ended: (reasons: string[]) => void;
}

/**
 * Attaches the guard to a window that lives for the whole app run. Returns `release`, which the
 * caller invokes once the timer is stopped so the next shutdown request goes through.
 */
export function attachShutdownGuard(win: BrowserWindow, deps: ShutdownGuardDeps): { release: () => void } {
  // One prompt per shutdown attempt: Windows can send the query again (and the person can click
  // Shut down twice), which must not stack dialogs.
  let prompting = false;

  win.on("query-session-end", (event) => {
    const reasons = event.reasons ?? [];
    if (!deps.isActive()) return; // nothing open: never delay a shutdown
    if (reasons.includes("critical")) {
      log("warn", "Critical session end with an open timer; it can't be blocked. Recovery will run on next start.");
      return;
    }
    event.preventDefault();
    log("info", `Blocked session end (${reasons.join(", ") || "shutdown"}) because a timer is open`);
    if (!prompting) {
      prompting = true;
      deps.prompt(reasons);
    }
  });

  win.on("session-end", (event) => {
    log("warn", `Session ending (${(event.reasons ?? []).join(", ")}) with timer ${deps.isActive() ? "open" : "closed"}`);
    deps.ended(event.reasons ?? []);
  });

  return {
    release: () => {
      prompting = false;
    },
  };
}
