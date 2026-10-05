import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { BOOT_RETRY_DELAYS, QUICK_RETRY_DELAYS, getBriefing, testConnection } from "./api";
import { describeError, log } from "./log";
import {
  getConnection,
  getServerUrl,
  hasToken,
  isAutostartInitialized,
  markAutostartInitialized,
  markShownToday,
  saveConnection,
  wasShownToday,
} from "./store";
import { createBriefingWindow, createSetupWindow, openExternalSafely, repositionBriefingWindow } from "./windows";

const AUTOSTART_ARG = "--autostart";
const BOOT_DELAY_MS = 6_000;
const REMIND_AFTER_MS = 30 * 60 * 1000;
const TOKEN_PATTERN = /^pcd_[A-Za-z0-9]{10,40}_[A-Za-z0-9_-]{30,80}$/;

const launchedAtLogin = process.argv.includes(AUTOSTART_ARG);
const useSample = process.argv.includes("--sample");

let tray: Tray | null = null;
let briefingWin: BrowserWindow | null = null;
let setupWin: BrowserWindow | null = null;
let lastState: unknown = null;
let fetching = false;
let remindTimer: NodeJS.Timeout | null = null;

// The companion must never crash because of a network or parsing problem.
process.on("uncaughtException", (err) => log("error", `Uncaught: ${describeError(err)}`));
process.on("unhandledRejection", (err) => log("error", `Unhandled rejection: ${describeError(err)}`));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => void showBriefing(QUICK_RETRY_DELAYS));
  app.setAppUserModelId("com.priinteve.companion");
  app.whenReady().then(onReady).catch((err) => log("error", `Startup failed: ${describeError(err)}`));
}

// Tray app: closing windows must not quit.
app.on("window-all-closed", () => undefined);

async function onReady(): Promise<void> {
  initAutostart();
  createTray();
  registerIpc();
  screen.on("display-metrics-changed", () => {
    if (briefingWin && !briefingWin.isDestroyed()) repositionBriefingWindow(briefingWin);
  });

  if (launchedAtLogin) {
    // Give the desktop and network a moment after sign-in, then brief only once per day.
    setTimeout(() => {
      if (!wasShownToday()) void showBriefing(BOOT_RETRY_DELAYS);
      else log("info", "Already briefed today; staying in the tray.");
    }, BOOT_DELAY_MS);
  } else {
    void showBriefing(BOOT_RETRY_DELAYS);
  }
}

// ---------------------------------------------------------------------------
// Start with Windows
// ---------------------------------------------------------------------------

function isAutostartEnabled(): boolean {
  return app.getLoginItemSettings({ path: process.execPath, args: [AUTOSTART_ARG] }).openAtLogin;
}

function setAutostart(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: [AUTOSTART_ARG] });
  log("info", `Start with Windows ${enabled ? "enabled" : "disabled"}`);
}

function initAutostart(): void {
  // Turn autostart on the first time the installed app runs; afterwards the tray toggle decides.
  if (app.isPackaged && !isAutostartInitialized()) {
    setAutostart(true);
    markAutostartInitialized();
  }
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray(): void {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "tray.png"));
  if (icon.isEmpty()) log("error", "Tray icon image could not be loaded");
  tray = new Tray(icon);
  tray.setToolTip("Priinteve Companion");
  // Open the menu ourselves instead of relying on setContextMenu, so right-click behaves the same everywhere.
  tray.on("click", toggleBriefing);
  tray.on("right-click", () => tray?.popUpContextMenu(buildMenu()));
  log("info", "Tray icon created");
}

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: "Show briefing now", click: () => void showBriefing(QUICK_RETRY_DELAYS) },
    { label: "Open settings", click: openSetup },
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: isAutostartEnabled(),
      // Registering the unpackaged dev build (electron.exe) would be wrong, so only the installed app can toggle it.
      enabled: app.isPackaged,
      click: (item) => setAutostart(item.checked),
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}

// ---------------------------------------------------------------------------
// Briefing window
// ---------------------------------------------------------------------------

function sendState(state: unknown): void {
  lastState = state;
  if (briefingWin && !briefingWin.isDestroyed()) briefingWin.webContents.send("briefing:state", state);
}

function ensureBriefingWindow(): BrowserWindow {
  if (!briefingWin || briefingWin.isDestroyed()) {
    briefingWin = createBriefingWindow();
    briefingWin.on("closed", () => {
      briefingWin = null;
    });
  }
  return briefingWin;
}

async function showBriefing(delays: number[], fresh = false): Promise<void> {
  if (remindTimer) {
    clearTimeout(remindTimer);
    remindTimer = null;
  }
  try {
    const win = ensureBriefingWindow();
    if (win.webContents.isLoading()) {
      await new Promise<void>((resolve) => win.webContents.once("did-finish-load", () => resolve()));
    }
    win.showInactive();
    sendState({ kind: "enter" });
  } catch (err) {
    log("error", `Could not open the briefing window: ${describeError(err)}`);
    return;
  }

  if (fetching) return;
  fetching = true;
  try {
    sendState({ kind: "loading", attempt: 0, total: delays.length });
    const result = await getBriefing(
      delays,
      (attempt, total) => sendState({ kind: "loading", attempt, total }),
      useSample,
      fresh,
    );
    sendState({ kind: "briefing", briefing: result.briefing, source: result.source });
    markShownToday();
  } catch (err) {
    // getBriefing never throws, but keep the window usable regardless.
    log("error", `Showing briefing failed: ${describeError(err)}`);
  } finally {
    fetching = false;
  }
}

/** Tray click: slide the briefing away if it's showing, otherwise show it. */
function toggleBriefing(): void {
  if (briefingWin && !briefingWin.isDestroyed() && briefingWin.isVisible()) {
    // Not stored in lastState: the renderer plays its exit animation, then asks us to hide.
    briefingWin.webContents.send("briefing:state", { kind: "leave" });
    return;
  }
  void showBriefing(QUICK_RETRY_DELAYS);
}

function hideBriefing(): void {
  if (briefingWin && !briefingWin.isDestroyed()) briefingWin.hide();
}

function openSetup(): void {
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.focus();
    return;
  }
  setupWin = createSetupWindow();
  setupWin.on("closed", () => {
    setupWin = null;
  });
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function fromBriefing(event: IpcMainEvent): boolean {
  return !!briefingWin && !briefingWin.isDestroyed() && event.sender === briefingWin.webContents;
}

function fromSetup(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return !!setupWin && !setupWin.isDestroyed() && event.sender === setupWin.webContents;
}

function normaliseServerUrl(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("Enter the panel address.");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That doesn't look like a web address.");
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("Use an https:// address (http is only allowed for localhost).");
  }
  return url.origin;
}

function readTokenInput(raw: unknown, required: boolean): string | null {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    if (required) throw new Error("Paste the device token from the Companion page.");
    return null;
  }
  if (!TOKEN_PATTERN.test(token)) throw new Error("That token doesn't look right. Copy it again from the panel.");
  return token;
}

function registerIpc(): void {
  ipcMain.on("briefing:ready", (event) => {
    if (fromBriefing(event) && lastState) event.sender.send("briefing:state", lastState);
  });
  ipcMain.on("briefing:dismiss", (event) => {
    if (fromBriefing(event)) hideBriefing();
  });
  ipcMain.on("briefing:remind", (event) => {
    if (!fromBriefing(event)) return;
    hideBriefing();
    if (remindTimer) clearTimeout(remindTimer);
    remindTimer = setTimeout(() => void showBriefing(QUICK_RETRY_DELAYS), REMIND_AFTER_MS);
    log("info", "Reminder set for 30 minutes");
  });
  ipcMain.on("briefing:refresh", (event) => {
    if (fromBriefing(event)) void showBriefing(QUICK_RETRY_DELAYS, true);
  });
  ipcMain.on("briefing:menu", (event) => {
    if (fromBriefing(event) && briefingWin) buildMenu().popup({ window: briefingWin });
  });
  ipcMain.on("briefing:interactive", (event, interactive: unknown) => {
    if (!fromBriefing(event) || !briefingWin) return;
    briefingWin.setIgnoreMouseEvents(interactive !== true, { forward: true });
  });
  ipcMain.on("open-url", (event, url: unknown) => {
    if (fromBriefing(event) || fromSetup(event)) void openExternalSafely(url);
  });

  ipcMain.handle("settings:get", (event) => {
    if (!fromSetup(event)) return null;
    return { serverUrl: getServerUrl(), hasToken: hasToken() };
  });
  ipcMain.handle("settings:save", (event, input: { serverUrl?: unknown; token?: unknown }) => {
    if (!fromSetup(event)) return { ok: false, message: "Not allowed." };
    try {
      const serverUrl = normaliseServerUrl(input?.serverUrl);
      const token = readTokenInput(input?.token, !hasToken());
      saveConnection(serverUrl, token);
      log("info", "Connection settings saved");
      return { ok: true, message: "Saved. The next briefing will use these settings." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Could not save." };
    }
  });
  ipcMain.handle("settings:test", async (event, input: { serverUrl?: unknown; token?: unknown }) => {
    if (!fromSetup(event)) return { ok: false, message: "Not allowed." };
    try {
      const serverUrl = normaliseServerUrl(input?.serverUrl);
      const token = readTokenInput(input?.token, false) ?? getConnection()?.token;
      if (!token) return { ok: false, message: "Paste the device token first." };
      return { ok: true, message: await testConnection(serverUrl, token) };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Test failed." };
    }
  });
  ipcMain.on("settings:open-panel", (event) => {
    if (!fromSetup(event)) return;
    const server = getServerUrl();
    if (server) void openExternalSafely(new URL("/companion", server).toString());
  });
}
