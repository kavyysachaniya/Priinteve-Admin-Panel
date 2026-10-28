import { BrowserWindow, screen, shell } from "electron";
import path from "node:path";

export const MAIN_WIDTH = 400;
export const MAIN_HEIGHT = 640;

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

/** The app window: a normal, framed window. Closing it hides it to the tray (see main.ts). */
export function createMainWindow(saved?: { x: number; y: number } | null): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const fits =
    saved &&
    saved.x >= workArea.x - MAIN_WIDTH / 2 &&
    saved.x <= workArea.x + workArea.width - MAIN_WIDTH / 2 &&
    saved.y >= workArea.y &&
    saved.y <= workArea.y + workArea.height - 80;
  const win = new BrowserWindow({
    width: MAIN_WIDTH,
    height: MAIN_HEIGHT,
    minWidth: 360,
    minHeight: 520,
    x: fits ? saved.x : workArea.x + workArea.width - MAIN_WIDTH - 24,
    y: fits ? saved.y : workArea.y + workArea.height - MAIN_HEIGHT - 24,
    title: "Priinteve Time Tracker",
    autoHideMenuBar: true,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: secureWebPreferences,
  });
  win.setMenu(null);
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
