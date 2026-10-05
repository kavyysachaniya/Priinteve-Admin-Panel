import { BrowserWindow, screen, shell } from "electron";
import path from "node:path";

const BRIEFING_WIDTH = 440;
const BRIEFING_HEIGHT = 600;
const EDGE_MARGIN = 8;

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

export function createBriefingWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: BRIEFING_WIDTH,
    height: BRIEFING_HEIGHT,
    x: workArea.x + workArea.width - BRIEFING_WIDTH - EDGE_MARGIN,
    y: workArea.y + workArea.height - BRIEFING_HEIGHT - EDGE_MARGIN,
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

/** Keep the window pinned to the bottom-right if the display layout changes. */
export function repositionBriefingWindow(win: BrowserWindow): void {
  const { workArea } = screen.getPrimaryDisplay();
  win.setPosition(
    workArea.x + workArea.width - BRIEFING_WIDTH - EDGE_MARGIN,
    workArea.y + workArea.height - BRIEFING_HEIGHT - EDGE_MARGIN,
  );
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
