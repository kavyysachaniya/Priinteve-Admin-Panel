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
import { compareVersions, type Briefing, type UpdateInfo } from "../shared/briefing";
import { BOOT_RETRY_DELAYS, QUICK_RETRY_DELAYS, getBriefing, testConnection } from "./api";
import { startReminders } from "./reminders";
import { fetchLive, fetchReminder, fetchUpdateInfo, postTaskAction } from "./server";
import { downloadUpdate, launchInstaller } from "./updater";
import { describeError, log } from "./log";
import {
  areRemindersPaused,
  getConnection,
  getMascotSize,
  getWindowPos,
  setMascotSize,
  setWindowPos,
  type MascotSize,
  getServerUrl,
  getUpdateSnoozeUntil,
  hasToken,
  isAutostartInitialized,
  markAutostartInitialized,
  markChecksShownToday,
  markShownToday,
  saveConnection,
  setRemindersPaused,
  snoozeUpdatePrompt,
  stopRemindersToday,
  wasChecksShownToday,
} from "./store";
import {
  BRIEFING_HEIGHT,
  DOCKED_HEIGHT,
  clampOpenPosition,
  createBriefingWindow,
  createSetupWindow,
  defaultOpenPosition,
  dockedBounds,
  openExternalSafely,
} from "./windows";

const AUTOSTART_ARG = "--autostart";
const BOOT_DELAY_MS = 6_000;
const REMIND_AFTER_MS = 30 * 60 * 1000;
const TOKEN_PATTERN = /^pcd_[A-Za-z0-9]{10,40}_[A-Za-z0-9_-]{30,80}$/;

// Prefilled in the setup window so a new user only has to paste their device token.
const DEFAULT_SERVER_URL = process.env.COMPANION_DEFAULT_SERVER_URL || "https://priinteve-admin-panel.vercel.app";

const launchedAtLogin = process.argv.includes(AUTOSTART_ARG);
const useSample = process.argv.includes("--sample");

let tray: Tray | null = null;
let briefingWin: BrowserWindow | null = null;
let setupWin: BrowserWindow | null = null;
let lastState: unknown = null;
let fetching = false;
let remindTimer: NodeJS.Timeout | null = null;
/** What the window is currently showing, so a reminder never covers a briefing the person is reading. */
let windowMode: "briefing" | "reminder" | "update" = "briefing";
let briefingDocked = false;
/** True while the briefing on screen is the day's first (it carries the checks), so Refresh keeps them. */
let dailyBriefingOpen = false;

// Live updates while the bubble is open: the renderer says which tasks are on screen, and we ask
// the panel every 20 s (and right after an action) for the running timer and those tasks' status.
const LIVE_INTERVAL_MS = 20_000;
let watchedTaskIds: string[] = [];
let livePolling = false;
let liveTimer: NodeJS.Timeout | null = null;

async function pollLive(): Promise<void> {
  if (livePolling || useSample || !getConnection()) return;
  if (!briefingVisible() || briefingDocked) return;
  livePolling = true;
  try {
    const live = await fetchLive(watchedTaskIds);
    if (live && briefingWin && !briefingWin.isDestroyed()) briefingWin.webContents.send("live:state", live);
  } catch (err) {
    log("warn", `Live update failed: ${describeError(err)}`);
  } finally {
    livePolling = false;
  }
}

function startLivePolling(): void {
  if (liveTimer) return;
  liveTimer = setInterval(() => void pollLive(), LIVE_INTERVAL_MS);
}
/** Where the open window was before it was minimised, so it can return there. */
let openBounds: { x: number; y: number } | null = null;
let dragOrigin: { x: number; y: number } | null = null;

/** Minimise: shrink to a strip on the right screen edge. Open: grow back to where it was. */
function applyDock(docked: boolean): void {
  if (docked === briefingDocked) return;
  briefingDocked = docked;
  if (docked) dailyBriefingOpen = false;
  const win = briefingWin;
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  if (docked) {
    openBounds = { x: b.x, y: b.y };
    // Keep the mascot where it is vertically: the window shrinks upwards from its bottom edge.
    win.setBounds(dockedBounds(b.y + b.height));
  } else {
    const back = clampOpenPosition(openBounds?.x ?? defaultOpenPosition().x, b.y + b.height - BRIEFING_HEIGHT);
    win.setBounds({ x: back.x, y: back.y, width: b.width, height: BRIEFING_HEIGHT });
    setWindowPos(back);
  }
}

function sendUiState(): void {
  if (briefingWin && !briefingWin.isDestroyed()) briefingWin.webContents.send("ui:state", { size: getMascotSize() });
}

function chooseSize(size: MascotSize): void {
  setMascotSize(size);
  sendUiState();
}

// Click-through handling. The briefing window is a big transparent rectangle; it should only
// catch the mouse over the mascot and the bubble. The renderer reports those rectangles and we
// compare them with the cursor position a few times a second, which is more dependable than
// relying on the page to see mouse-move events through a click-through window.
type HitRect = { x: number; y: number; w: number; h: number };
let hitRects: HitRect[] = [];
let windowInteractive = false;
let hitTimer: NodeJS.Timeout | null = null;
const HIT_PADDING = 6;

function startHitTesting(): void {
  if (hitTimer) return;
  hitTimer = setInterval(() => {
    const win = briefingWin;
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    const x = cursor.x - bounds.x;
    const y = cursor.y - bounds.y;
    const inside = hitRects.some(
      (r) => x >= r.x - HIT_PADDING && x <= r.x + r.w + HIT_PADDING && y >= r.y - HIT_PADDING && y <= r.y + r.h + HIT_PADDING,
    );
    if (inside !== windowInteractive) {
      windowInteractive = inside;
      win.setIgnoreMouseEvents(!inside, { forward: true });
    }
  }, 40);
}

const UPDATE_FIRST_CHECK_MS = 60_000;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_SNOOZE_MS = 6 * 60 * 60 * 1000;
// Auto-update only runs in the installed app (the dev build would try to replace itself).
const updatesEnabled = () => app.isPackaged || process.env.COMPANION_CHECK_UPDATES === "1";

type UpdateViewState = { phase: "available" | "downloading" | "installing" | "error"; version: string; percent?: number; message?: string };
let pendingUpdate: UpdateInfo | null = null;
let updateState: UpdateViewState | null = null;
let installing = false;

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
    if (briefingWin && !briefingWin.isDestroyed()) {
      const b = briefingWin.getBounds();
      if (briefingDocked) briefingWin.setBounds(dockedBounds(b.y + b.height));
      else {
        const p = clampOpenPosition(b.x, b.y);
        briefingWin.setPosition(p.x, p.y);
      }
    }
  });

  if (!useSample) {
    const testTick = app.isPackaged ? undefined : Number(process.env.COMPANION_REMINDER_TEST_MS) || undefined;
    startLivePolling();
    startReminders({ fetchReminder, show: (briefing) => void showReminder(briefing) }, testTick);
    scheduleUpdateChecks();
  }

  if (!useSample && !getConnection()) {
    // Fresh install: there is nothing to brief on until the computer is paired, so start with setup.
    log("info", "Not paired yet; opening settings");
    openSetup();
  } else if (launchedAtLogin) {
    // Give the desktop and network a moment after sign-in, then show the briefing. It appears on
    // every start; only the websites, Slack and email checks are limited to once a day.
    setTimeout(() => void showBriefing(BOOT_RETRY_DELAYS), BOOT_DELAY_MS);
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
    {
      label: "Mascot size",
      submenu: (["small", "medium", "large"] as const).map((size) => ({
        label: size[0].toUpperCase() + size.slice(1),
        type: "radio" as const,
        checked: getMascotSize() === size,
        click: () => chooseSize(size),
      })),
    },
    {
      label: "Project reminders (every 30 min)",
      type: "checkbox",
      checked: !areRemindersPaused(),
      click: (item) => setRemindersPaused(!item.checked),
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
    briefingWin = createBriefingWindow(getWindowPos());
    windowInteractive = false;
    startHitTesting();
    briefingWin.on("closed", () => {
      briefingWin = null;
    });
  }
  return briefingWin;
}

async function showBriefing(delays: number[], fresh = false): Promise<void> {
  if (!useSample && !getConnection()) {
    openSetup();
    return;
  }
  if (remindTimer) {
    clearTimeout(remindTimer);
    remindTimer = null;
  }
  windowMode = "briefing";
  try {
    const win = ensureBriefingWindow();
    if (win.webContents.isLoading()) {
      await new Promise<void>((resolve) => win.webContents.once("did-finish-load", () => resolve()));
    }
    if (!win.isVisible()) win.showInactive();
    sendState({ kind: "enter" });
  } catch (err) {
    log("error", `Could not open the briefing window: ${describeError(err)}`);
    return;
  }

  if (fetching) return;
  fetching = true;
  try {
    sendState({ kind: "loading", attempt: 0, total: delays.length });
    const daily = !wasChecksShownToday() || dailyBriefingOpen;
    const result = await getBriefing(
      delays,
      (attempt, total) => sendState({ kind: "loading", attempt, total }),
      useSample,
      fresh,
      daily,
    );
    sendState({ kind: "briefing", briefing: result.briefing, source: result.source, mode: "briefing" });
    markShownToday();
    // Only a real, live answer counts as "the checks were shown"; an offline copy doesn't.
    if (daily && result.source === "live") {
      markChecksShownToday();
      dailyBriefingOpen = true;
    }
  } catch (err) {
    // getBriefing never throws, but keep the window usable regardless.
    log("error", `Showing briefing failed: ${describeError(err)}`);
  } finally {
    fetching = false;
  }
}

function briefingVisible(): boolean {
  return !!briefingWin && !briefingWin.isDestroyed() && briefingWin.isVisible();
}

/** Opens the window (without stealing focus) and waits until the page has loaded. */
async function openWindow(): Promise<boolean> {
  try {
    const win = ensureBriefingWindow();
    if (win.webContents.isLoading()) {
      await new Promise<void>((resolve) => win.webContents.once("did-finish-load", () => resolve()));
    }
    if (!win.isVisible()) win.showInactive();
    sendState({ kind: "enter" });
    return true;
  } catch (err) {
    log("error", `Could not open the briefing window: ${describeError(err)}`);
    return false;
  }
}

/** The 30-minute project check-in. Skipped while a morning briefing is open. */
async function showReminder(briefing: Briefing): Promise<void> {
  // Don't cover a briefing the person has open and is reading (a docked one doesn't count).
  if (briefingVisible() && !briefingDocked && windowMode === "briefing") return;
  if (!(await openWindow())) return;
  windowMode = "reminder";
  sendState({ kind: "briefing", briefing, source: "live", mode: "reminder" });
  if (updateState) sendUpdate(updateState);
}

function sendUpdate(state: UpdateViewState | null): void {
  updateState = state;
  if (briefingWin && !briefingWin.isDestroyed()) briefingWin.webContents.send("update:state", state);
}

/** Shows a small "update available" bubble when the window isn't already open. */
async function showUpdatePrompt(info: UpdateInfo): Promise<void> {
  if (!(await openWindow())) return;
  windowMode = "update";
  sendState({
    kind: "briefing",
    mode: "update",
    source: "live",
    briefing: {
      generatedAt: new Date().toISOString(),
      mascotName: "Inky",
      ownerName: "",
      greeting: "Update available",
      summary: `Version ${info.version} of the Companion is ready to install.`,
      mood: "happy",
      sections: [],
    },
  });
  sendUpdate({ phase: "available", version: info.version });
}

function scheduleUpdateChecks(): void {
  if (!updatesEnabled()) return;
  setTimeout(() => {
    void runUpdateCheck();
    setInterval(() => void runUpdateCheck(), UPDATE_INTERVAL_MS);
  }, UPDATE_FIRST_CHECK_MS);
}

async function runUpdateCheck(): Promise<void> {
  if (installing || !getConnection()) return;
  const current = app.getVersion();
  const info = await fetchUpdateInfo(current);
  if (!info || compareVersions(info.version, current) <= 0) return;
  pendingUpdate = info;
  if (Date.now() < getUpdateSnoozeUntil()) return;
  log("info", `Update ${info.version} is available (running ${current})`);
  if (briefingVisible()) sendUpdate({ phase: "available", version: info.version });
  else await showUpdatePrompt(info);
}

async function installUpdate(): Promise<void> {
  if (!pendingUpdate || installing || !updatesEnabled()) return;
  installing = true;
  try {
    // The signed link in the original answer lasts 10 minutes; ask again for a fresh one.
    const fresh = await fetchUpdateInfo(app.getVersion());
    const info = fresh && compareVersions(fresh.version, app.getVersion()) > 0 ? fresh : pendingUpdate;
    pendingUpdate = info;
    sendUpdate({ phase: "downloading", version: info.version, percent: 0 });
    const file = await downloadUpdate(info, (percent) => sendUpdate({ phase: "downloading", version: info.version, percent }));
    sendUpdate({ phase: "installing", version: info.version });
    log("info", `Installing update ${info.version}`);
    launchInstaller(file);
    // The installer replaces this app's files and starts the new version when it finishes.
    setTimeout(() => app.exit(0), 800);
  } catch (err) {
    installing = false;
    log("warn", `Update failed: ${describeError(err)}`);
    sendUpdate({
      phase: "error",
      version: pendingUpdate?.version ?? "",
      message: err instanceof Error ? err.message : "The update failed. Please try again.",
    });
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
    if (!fromBriefing(event)) return;
    sendUiState();
    if (lastState) event.sender.send("briefing:state", lastState);
    if (updateState) event.sender.send("update:state", updateState);
  });
  ipcMain.on("briefing:stop-today", (event) => {
    if (!fromBriefing(event)) return;
    stopRemindersToday();
    log("info", "Project reminders stopped for today");
  });
  ipcMain.on("update:install", (event) => {
    if (fromBriefing(event)) void installUpdate();
  });
  ipcMain.on("update:later", (event) => {
    if (!fromBriefing(event)) return;
    snoozeUpdatePrompt(Date.now() + UPDATE_SNOOZE_MS);
    sendUpdate(null);
  });
  ipcMain.on("briefing:dismiss", (event) => {
    if (fromBriefing(event)) hideBriefing();
  });
  ipcMain.on("briefing:remind", (event) => {
    if (!fromBriefing(event)) return;
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
  ipcMain.on("briefing:docked", (event, value: unknown) => {
    if (!fromBriefing(event)) return;
    applyDock(value === true);
    if (value !== true) void pollLive(); // opened again: bring the rows up to date straight away
  });
  ipcMain.on("briefing:watch-tasks", (event, ids: unknown) => {
    if (!fromBriefing(event) || !Array.isArray(ids)) return;
    watchedTaskIds = ids.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(id)).slice(0, 40);
    void pollLive();
  });
  ipcMain.on("briefing:drag-start", (event) => {
    if (!fromBriefing(event) || !briefingWin) return;
    const b = briefingWin.getBounds();
    dragOrigin = { x: b.x, y: b.y };
  });
  ipcMain.on("briefing:drag-move", (event, dx: unknown, dy: unknown) => {
    if (!fromBriefing(event) || !briefingWin || !dragOrigin) return;
    if (typeof dx !== "number" || typeof dy !== "number" || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const win = briefingWin;
    const { workArea } = screen.getPrimaryDisplay();
    if (briefingDocked) {
      // Minimised: slide along the right screen edge only.
      const y = Math.min(Math.max(dragOrigin.y + dy, workArea.y), workArea.y + workArea.height - DOCKED_HEIGHT);
      win.setPosition(win.getBounds().x, Math.round(y));
    } else {
      const p = clampOpenPosition(dragOrigin.x + dx, dragOrigin.y + dy);
      win.setPosition(p.x, p.y);
    }
  });
  ipcMain.on("briefing:drag-end", (event) => {
    if (!fromBriefing(event) || !briefingWin) return;
    dragOrigin = null;
    if (!briefingDocked) {
      const b = briefingWin.getBounds();
      setWindowPos({ x: b.x, y: b.y });
    }
  });
  ipcMain.on("briefing:hit-rects", (event, rects: unknown) => {
    if (!fromBriefing(event) || !Array.isArray(rects)) return;
    hitRects = rects
      .slice(0, 4)
      .filter((r): r is HitRect => !!r && [r.x, r.y, r.w, r.h].every((n) => typeof n === "number" && Number.isFinite(n)));
  });
  ipcMain.on("briefing:interactive", (event, interactive: unknown) => {
    if (!fromBriefing(event) || !briefingWin) return;
    briefingWin.setIgnoreMouseEvents(interactive !== true, { forward: true });
  });
  ipcMain.on("open-url", (event, url: unknown) => {
    if (fromBriefing(event) || fromSetup(event)) void openExternalSafely(url);
  });

  ipcMain.handle("task:action", async (event, input: { action?: unknown; taskId?: unknown }) => {
    if (!briefingWin || briefingWin.isDestroyed() || event.sender !== briefingWin.webContents) {
      return { ok: false, message: "Not allowed." };
    }
    const action = input?.action;
    const taskId = typeof input?.taskId === "string" ? input.taskId : "";
    if (action !== "complete" && action !== "start-timer" && action !== "stop-timer") return { ok: false, message: "Unknown action." };
    if (action !== "stop-timer" && !/^[A-Za-z0-9_-]{1,40}$/.test(taskId)) return { ok: false, message: "Unknown task." };
    const result = await postTaskAction(action, taskId);
    // Whatever the action changed (a timer started elsewhere stops, etc.), refresh the rows now.
    if (result.ok) setTimeout(() => void pollLive(), 400);
    return result;
  });
  ipcMain.handle("settings:get", (event) => {
    if (!fromSetup(event)) return null;
    return { serverUrl: getServerUrl() || DEFAULT_SERVER_URL, hasToken: hasToken() };
  });
  ipcMain.handle("settings:save", (event, input: { serverUrl?: unknown; token?: unknown }) => {
    if (!fromSetup(event)) return { ok: false, message: "Not allowed." };
    try {
      const serverUrl = normaliseServerUrl(input?.serverUrl);
      const token = readTokenInput(input?.token, !hasToken());
      saveConnection(serverUrl, token);
      log("info", "Connection settings saved");
      // Show the first real briefing straight away so the person sees it working.
      void showBriefing(QUICK_RETRY_DELAYS, true);
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
