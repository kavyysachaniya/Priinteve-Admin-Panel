import { BrowserWindow, screen, shell } from "electron";
import path from "node:path";

export const BRIEFING_WIDTH = 440;
export const BRIEFING_HEIGHT = 600;
/** Height of the window while minimised: just tall enough for the (largest) mascot. */
export const DOCKED_HEIGHT = 230;
/** The bubble starts this far from the window's left edge, so the window may hang off-screen by that much. */
const BUBBLE_LEFT_OVERHANG = 58;
const EDGE_MARGIN = 0; // flush with the work-area edge so the docked mascot peeks from the screen edge

const preload = path.join(__dirname, "..", "preload.js");
const rendererDir = path.join(__dirname, "..", "renderer");

const secureWebPreferences = {
  preload,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  spellcheck: false,
};

/** Block in-window navigation and pop-ups: links only ever open in the default browser via IPC. */
function lockDown(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
}

/** Bottom-right corner of the work area. */
export function defaultOpenPosition(): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - BRIEFING_WIDTH - EDGE_MARGIN,
    y: workArea.y + workArea.height - BRIEFING_HEIGHT - EDGE_MARGIN,
  };
}

/** Keeps the open window (mascot and bubble) inside the work area. */
export function clampOpenPosition(x: number, y: number): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(Math.min(Math.max(x, workArea.x - BUBBLE_LEFT_OVERHANG), workArea.x + workArea.width - BRIEFING_WIDTH)),
    y: Math.round(Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - BRIEFING_HEIGHT)),
  };
}

/** The minimised window: flush with the right screen edge, as tall as the mascot needs. */
export function dockedBounds(bottom: number): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay();
  const y = Math.min(Math.max(bottom - DOCKED_HEIGHT, workArea.y), workArea.y + workArea.height - DOCKED_HEIGHT);
  return { x: workArea.x + workArea.width - BRIEFING_WIDTH, y: Math.round(y), width: BRIEFING_WIDTH, height: DOCKED_HEIGHT };
}

export function createBriefingWindow(saved?: { x: number; y: number } | null): BrowserWindow {
  const start = saved ? clampOpenPosition(saved.x, saved.y) : defaultOpenPosition();
  const win = new BrowserWindow({
    width: BRIEFING_WIDTH,
    height: BRIEFING_HEIGHT,
    x: start.x,
    y: start.y,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    focusable: true,
    backgroundColor: "#00000000",
    webPreferences: secureWebPreferences,
  });
  win.setAlwaysOnTop(true, "floating");
  // Transparent areas pass clicks through to the desktop; the renderer turns
  // mouse capture on while the pointer is over the mascot or the bubble.
  win.setIgnoreMouseEvents(true, { forward: true });
  lockDown(win);
  void win.loadFile(path.join(rendererDir, "index.html"));
  return win;
}


export function createSetupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 520,
    resizable: false,
    maximizable: false,
    minimizable: false,
    title: "Priinteve Companion settings",
    autoHideMenuBar: true,
    show: false,
    webPreferences: secureWebPreferences,
  });
  lockDown(win);
  win.once("ready-to-show", () => win.show());
  void win.loadFile(path.join(rendererDir, "setup.html"));
  return win;
}

const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

export async function openExternalSafely(rawUrl: unknown): Promise<void> {
  if (typeof rawUrl !== "string") return;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return;
  await shell.openExternal(url.toString());
}
