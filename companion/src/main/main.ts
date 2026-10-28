import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  Tray,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { compareVersions, type Briefing, type UpdateInfo } from "../shared/briefing";
import { formatClock, workedSeconds } from "../shared/timer";
import { BOOT_RETRY_DELAYS, QUICK_RETRY_DELAYS, getBriefing, testConnection } from "./api";
import { startReminders } from "./reminders";
import { fetchReminder, fetchTimerState, fetchUpdateInfo, postTaskAction, postTimerOps } from "./server";
import { attachShutdownGuard, BLOCK_REASON, setShutdownBlockReason } from "./shutdown";
import { TimerController, type ActionInput, type Interruption } from "./timer";
import { downloadUpdate, launchInstaller } from "./updater";
import { describeError, log } from "./log";
import {
  areRemindersPaused,
  getConnection,
  getServerUrl,
  getUpdateSnoozeUntil,
  getWindowPos,
  hasToken,
  isAutostartInitialized,
  markAutostartInitialized,
  markChecksShownToday,
  markShownToday,
  saveConnection,
  setRemindersPaused,
  setWindowPos,
  snoozeUpdatePrompt,
  stopRemindersToday,
  wasChecksShownToday,
} from "./store";
import { createMainWindow, createSetupWindow, openExternalSafely } from "./windows";

// Priinteve Time Tracker (the desktop companion). One normal window with two tabs: Timer and
// Today (the morning briefing). It lives in the tray; closing the window hides it. Reminders and
// update offers arrive as Windows notifications. While a timer is open the app refuses Windows
// shutdown/restart until the person stops it (see shutdown.ts).

const AUTOSTART_ARG = "--autostart";
const TOKEN_PATTERN = /^pcd_[A-Za-z0-9]{10,40}_[A-Za-z0-9_-]{30,80}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const SHUTDOWN_FLUSH_MS = 5_000;

// Prefilled in the setup window so a new user only has to paste their device token.
const DEFAULT_SERVER_URL = process.env.COMPANION_DEFAULT_SERVER_URL || "https://priinteve-admin-panel.vercel.app";

const launchedAtLogin = process.argv.includes(AUTOSTART_ARG);
const useSample = process.argv.includes("--sample");

type Tab = "timer" | "today";

type Banner =
  | { kind: "shutdown"; phase: "ask" }
  | { kind: "shutdown"; phase: "done"; synced: boolean; message: string }
  | { kind: "quit" }
  | {
      kind: "recovery";
      projectName: string;
      taskTitle: string | null;
      startedAt: string;
      lastConfirmedAt: string;
      detectedAt: string;
    };

type TodayState =
  | { kind: "loading" }
  | { kind: "briefing"; briefing: Briefing; source: string; mode: "briefing" | "reminder" };

type UpdateViewState = { phase: "available" | "downloading" | "installing" | "error"; version: string; percent?: number; message?: string };

let tray: Tray | null = null;
let mainWin: BrowserWindow | null = null;
let setupWin: BrowserWindow | null = null;
let timer: TimerController | null = null;
let banner: Banner | null = null;
let today: TodayState | null = null;
let currentTab: Tab = "timer";
let fetchingToday = false;
let dailyBriefingOpen = false;
/** Set once the app is really going to exit (Quit after the timer check, or an update install). */
let quitting = false;
let shutdownGuard: { release: () => void } | null = null;
let trayTicker: NodeJS.Timeout | null = null;
let hintedTray = false;

const UPDATE_FIRST_CHECK_MS = 60_000;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_SNOOZE_MS = 6 * 60 * 60 * 1000;
// Auto-update only runs in the installed app (the dev build would try to replace itself).
const updatesEnabled = () => app.isPackaged || process.env.COMPANION_CHECK_UPDATES === "1";
let pendingUpdate: UpdateInfo | null = null;
let updateState: UpdateViewState | null = null;
let installing = false;

// The companion must never crash because of a network or parsing problem.
process.on("uncaughtException", (err) => log("error", `Uncaught: ${describeError(err)}`));
process.on("unhandledRejection", (err) => log("error", `Unhandled rejection: ${describeError(err)}`));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());
  app.setAppUserModelId("com.priinteve.companion");
  app.whenReady().then(onReady).catch((err) => log("error", `Startup failed: ${describeError(err)}`));
}

// Tray app: closing windows must not quit.
app.on("window-all-closed", () => undefined);

// Quitting from anywhere (tray, taskbar, Alt+F4 on the last window) goes through the timer check.
app.on("before-quit", (event) => {
  if (quitting) return;
  if (timer?.isActive()) {
    event.preventDefault();
    requestQuit();
    return;
  }
  quitting = true;
});

async function onReady(): Promise<void> {
  initAutostart();

  timer = new TimerController({ dataDir: app.getPath("userData"), fetchState: fetchTimerState, postOps: postTimerOps });
  timer.onChange(onTimerChanged);
  timer.onInterruption(onInterruption);

  createTray();
  registerIpc();
  ensureWindow();

  // After sleep or a lock the monotonic clock may have paused: re-anchor and ask the server.
  const onWake = (event: string) => () => {
    log("info", `Power event: ${event}`);
    timer?.reanchor();
    void timer?.flush();
  };
  powerMonitor.on("resume", onWake("resume"));
  powerMonitor.on("unlock-screen", onWake("unlock-screen"));

  if (!useSample) {
    timer.start();
    const testTick = app.isPackaged ? undefined : Number(process.env.COMPANION_REMINDER_TEST_MS) || undefined;
    startReminders({ fetchReminder, show: (briefing) => showReminder(briefing) }, testTick);
    scheduleUpdateChecks();
  }

  if (!useSample && !getConnection()) {
    // Fresh install: nothing to track or brief on until the computer is paired, so start with setup.
    log("info", "Not paired yet; opening settings");
    openSetup();
    return;
  }

  if (launchedAtLogin) {
    // Signed in to Windows: stay in the tray, prepare the briefing and offer it as a notification.
    // An open timer still shows the window, so a running clock is never hidden.
    if (timer.isActive()) showWindow("timer");
    void loadToday(BOOT_RETRY_DELAYS, false, true);
  } else {
    showWindow("timer");
    void loadToday(BOOT_RETRY_DELAYS);
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
// Window
// ---------------------------------------------------------------------------

function ensureWindow(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed()) return mainWin;
  const win = createMainWindow(getWindowPos());
  mainWin = win;
  win.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    if (!timer?.isActive()) {
      // Nothing to protect: hide to the tray.
      win.hide();
      return;
    }
    // Windows ignores a shutdown refusal from an app with no visible window and closes it anyway
    // (learn.microsoft.com/windows/win32/shutdown/shutdown-changes-for-windows-vista), so while a
    // timer is open the window only minimises to the taskbar.
    win.minimize();
    if (!hintedTray) {
      hintedTray = true;
      notify(
        "Timer still running",
        "Priinteve stays in the taskbar while a timer is open, so Windows asks before restarting or shutting down.",
        () => showWindow("timer"),
      );
    }
  });
  win.on("moved", () => {
    const b = win.getBounds();
    setWindowPos({ x: b.x, y: b.y });
  });
  win.on("closed", () => {
    if (mainWin === win) mainWin = null;
  });
  // This window lives for the whole run, so it is the one that answers Windows' shutdown query.
  shutdownGuard = attachShutdownGuard(win, {
    isActive: () => timer?.isActive() ?? false,
    prompt: () => {
      setBanner({ kind: "shutdown", phase: "ask" });
      showWindow("timer", true);
    },
    ended: () => {
      // Windows is going ahead anyway (forced, or the person chose "Restart anyway"). Note when,
      // so the next start asks what to record instead of counting the time the PC was off.
      timer?.markSessionEnded();
      log("info", "Windows is ending the session; the timer journal is already on disk");
    },
  });
  onTimerChanged();
  return win;
}

function showWindow(tab?: Tab, focus = true): void {
  const win = ensureWindow();
  if (tab) setTab(tab);
  const reveal = () => {
    if (win.isMinimized()) win.restore();
    win.show();
    if (focus) win.focus();
  };
  if (win.webContents.isLoading()) win.webContents.once("did-finish-load", reveal);
  else reveal();
}

function send(channel: string, payload: unknown): void {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, payload);
}

function setTab(tab: Tab): void {
  currentTab = tab;
  send("app:tab", tab);
}

function setBanner(next: Banner | null): void {
  banner = next;
  send("app:banner", banner);
}

function notify(title: string, body: string, onClick: () => void): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: false });
  n.on("click", onClick);
  n.show();
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

function onTimerChanged(): void {
  if (!timer) return;
  const view = timer.view();
  send("timer:view", view);

  // Windows shows this text on its "apps preventing shutdown" screen while a timer is open.
  if (mainWin && !mainWin.isDestroyed()) setShutdownBlockReason(mainWin, view.status === "IDLE" ? null : BLOCK_REASON);
  ensureVisibleWhileActive(view.status !== "IDLE");

  if (view.status === "IDLE" && banner?.kind === "quit") setBanner(null);
  updateTray();
  if (view.status === "RUNNING" && !trayTicker) trayTicker = setInterval(updateTray, 1000);
  if (view.status !== "RUNNING" && trayTicker) {
    clearInterval(trayTicker);
    trayTicker = null;
  }
}

/**
 * Only an app with a visible window may refuse a Windows shutdown or restart. While a timer is
 * open (started here, in the browser, or found at startup) the window is kept at least minimised
 * in the taskbar, without taking focus.
 */
function ensureVisibleWhileActive(active: boolean): void {
  const win = mainWin;
  if (!active || !win || win.isDestroyed() || win.isVisible()) return;
  win.showInactive();
  win.minimize();
}

function onInterruption(i: Interruption): void {
  setBanner({
    kind: "recovery",
    projectName: i.projectName,
    taskTitle: i.taskTitle,
    startedAt: i.startedAt,
    lastConfirmedAt: i.lastConfirmedAt,
    detectedAt: i.detectedAt,
  });
  showWindow("timer");
  notify("Check your timer", "Your timer kept running while this PC was off or asleep. Choose what to record.", () =>
    showWindow("timer"),
  );
}

async function stopTimer(reason: "USER" | "SHUTDOWN"): Promise<{ ok: boolean; message: string }> {
  if (!timer) return { ok: false, message: "The timer isn't ready yet." };
  return timer.act({ type: "STOP", stopReason: reason });
}

function requestQuit(): void {
  if (timer?.isActive()) {
    setBanner({ kind: "quit" });
    showWindow("timer");
    return;
  }
  quitting = true;
  app.quit();
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray(): void {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "tray.png"));
  if (icon.isEmpty()) log("error", "Tray icon image could not be loaded");
  tray = new Tray(icon);
  tray.on("click", () => showWindow());
  // Open the menu ourselves instead of relying on setContextMenu, so right-click behaves the same everywhere.
  tray.on("right-click", () => tray?.popUpContextMenu(buildMenu()));
  updateTray();
  log("info", "Tray icon created");
}

/** One line for the tray: the same view the window shows, never a separate counter. */
function trayStatus(): string {
  if (!timer) return "Timer not ready";
  const view = timer.view();
  if (view.status === "IDLE") return "No timer running";
  const elapsed = formatClock(workedSeconds(view, timer.serverNow()));
  const what = [view.projectName, view.taskTitle].filter(Boolean).join(" · ");
  return `${view.status === "PAUSED" ? "Paused" : "Running"} ${elapsed} · ${what}`;
}

function updateTray(): void {
  // Windows limits tray tooltips to 127 characters.
  tray?.setToolTip(`Priinteve Time Tracker\n${trayStatus()}`.slice(0, 127));
}

function buildMenu(): Menu {
  const active = timer?.isActive() ?? false;
  return Menu.buildFromTemplate([
    { label: trayStatus(), enabled: false },
    { type: "separator" },
    { label: "Open time tracker", click: () => showWindow("timer") },
    {
      label: "Stop timer",
      enabled: active,
      click: () => void stopTimer("USER").then((r) => !r.ok && notify("Timer", r.message, () => showWindow("timer"))),
    },
    { label: "Today's briefing", click: () => showWindow("today") },
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
      label: "Project reminders (every 30 min)",
      type: "checkbox",
      checked: !areRemindersPaused(),
      click: (item) => setRemindersPaused(!item.checked),
    },
    { type: "separator" },
    { label: "Quit", click: requestQuit },
  ]);
}

// ---------------------------------------------------------------------------
// Today (briefing) and reminders
// ---------------------------------------------------------------------------

function setToday(state: TodayState): void {
  today = state;
  send("today:state", state);
}

async function loadToday(delays: number[], fresh = false, announce = false): Promise<void> {
  if (fetchingToday) return;
  fetchingToday = true;
  try {
    if (!today || today.kind !== "briefing") setToday({ kind: "loading" });
    const daily = !wasChecksShownToday() || dailyBriefingOpen;
    const result = await getBriefing(delays, undefined, useSample, fresh, daily);
    setToday({ kind: "briefing", briefing: result.briefing, source: result.source, mode: "briefing" });
    markShownToday();
    // Only a real, live answer counts as "the checks were shown"; an offline copy doesn't.
    if (daily && result.source === "live") {
      markChecksShownToday();
      dailyBriefingOpen = true;
    }
    if (announce) {
      notify(result.briefing.greeting || "Good morning", result.briefing.summary || "Your briefing is ready.", () =>
        showWindow("today"),
      );
    }
  } catch (err) {
    // getBriefing never throws, but keep the window usable regardless.
    log("error", `Loading the briefing failed: ${describeError(err)}`);
  } finally {
    fetchingToday = false;
  }
}

/** The 30-minute project check-in: a notification that opens the Today tab. */
function showReminder(briefing: Briefing): void {
  setToday({ kind: "briefing", briefing, source: "live", mode: "reminder" });
  notify(briefing.greeting || "Project check-in", briefing.summary || "Here's where your projects stand.", () =>
    showWindow("today"),
  );
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

function sendUpdate(state: UpdateViewState | null): void {
  updateState = state;
  send("update:state", state);
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
  sendUpdate({ phase: "available", version: info.version });
  notify("Update available", `Version ${info.version} of the time tracker is ready to install.`, () => showWindow());
}

async function installUpdate(): Promise<void> {
  if (!pendingUpdate || installing || !updatesEnabled()) return;
  // The installer closes this app; an open timer must be stopped first, like a shutdown.
  if (timer?.isActive()) {
    sendUpdate({ phase: "error", version: pendingUpdate.version, message: "Stop your timer before installing the update." });
    return;
  }
  installing = true;
  try {
    // The signed link in the original answer lasts 10 minutes; ask again for a fresh one.
    const fresh = await fetchUpdateInfo(app.getVersion());
    const info = fresh && compareVersions(fresh.version, app.getVersion()) > 0 ? fresh : pendingUpdate;
    pendingUpdate = info;
    sendUpdate({ phase: "downloading", version: info.version, percent: 0 });
    const file = await downloadUpdate(info, (percent) => sendUpdate({ phase: "downloading", version: info.version, percent }));
    if (timer?.isActive()) throw new Error("A timer was started during the download. Stop it, then install again.");
    sendUpdate({ phase: "installing", version: info.version });
    log("info", `Installing update ${info.version}`);
    launchInstaller(file);
    // The installer replaces this app's files and starts the new version when it finishes.
    quitting = true;
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

// ---------------------------------------------------------------------------
// Settings window
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function fromMain(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return !!mainWin && !mainWin.isDestroyed() && event.sender === mainWin.webContents;
}

function fromSetup(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return !!setupWin && !setupWin.isDestroyed() && event.sender === setupWin.webContents;
}

/** Validates what the window asks the timer to do; anything unexpected is refused. */
function readAction(input: unknown): ActionInput | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  switch (r.type) {
    case "START": {
      if (typeof r.projectId !== "string" || !ID_PATTERN.test(r.projectId)) return null;
      const taskId = typeof r.taskId === "string" && ID_PATTERN.test(r.taskId) ? r.taskId : undefined;
      const title = typeof r.newTaskTitle === "string" ? r.newTaskTitle.trim().slice(0, 200) : "";
      if (!taskId && title.length < 2) return null;
      return { type: "START", projectId: r.projectId, taskId, newTaskTitle: taskId ? undefined : title };
    }
    case "PAUSE":
      return { type: "PAUSE" };
    case "RESUME":
      return { type: "RESUME" };
    case "STOP":
      return { type: "STOP", stopReason: "USER" };
    default:
      return null;
  }
}

async function chooseBanner(kind: unknown, choice: unknown): Promise<{ ok: boolean; message: string }> {
  if (!banner || banner.kind !== kind || !timer) return { ok: false, message: "That prompt has already closed." };

  if (banner.kind === "shutdown") {
    if (choice === "return" || choice === "close") {
      setBanner(null);
      shutdownGuard?.release();
      return { ok: true, message: "" };
    }
    if (choice === "stop" && banner.phase === "ask") {
      const result = await stopTimer("SHUTDOWN");
      if (!result.ok) return result; // nothing was saved: say so and keep blocking
      const synced = await timer.flushWithin(SHUTDOWN_FLUSH_MS);
      shutdownGuard?.release();
      const message = synced
        ? "Timer stopped and saved. You can shut down or restart now."
        : "Timer stopped and saved on this PC; it will sync the next time you're online. You can shut down or restart now.";
      setBanner({ kind: "shutdown", phase: "done", synced, message });
      return { ok: true, message };
    }
  }

  if (banner.kind === "quit") {
    if (choice === "cancel") {
      setBanner(null);
      return { ok: true, message: "" };
    }
    if (choice === "stop-quit") {
      const result = await stopTimer("USER");
      if (!result.ok) return result;
      await timer.flushWithin(SHUTDOWN_FLUSH_MS);
      setBanner(null);
      quitting = true;
      app.quit();
      return result;
    }
  }

  if (banner.kind === "recovery") {
    const current = timer.currentInterruption();
    if (!current) {
      setBanner(null);
      return { ok: true, message: "" };
    }
    let result: { ok: boolean; message: string } = { ok: true, message: "Kept the timer running." };
    if (choice === "stop-last") {
      result = await timer.act({
        type: "STOP",
        stopReason: "RECOVERY",
        at: current.lastConfirmedAt,
        note: "Stopped at the last confirmed activity after an interruption",
      });
    } else if (choice === "stop-now") {
      result = await stopTimer("USER");
    } else if (choice !== "keep") {
      return { ok: false, message: "Unknown choice." };
    }
    if (result.ok) {
      timer.dismissInterruption(current.key);
      setBanner(null);
    }
    return result;
  }

  return { ok: false, message: "Unknown choice." };
}

const PANEL_PAGES: Record<string, string> = { timesheet: "/timesheet", tasks: "/tasks", timer: "/timer" };

function registerIpc(): void {
  ipcMain.on("app:ready", (event) => {
    if (!fromMain(event)) return;
    event.sender.send("app:tab", currentTab);
    if (timer) event.sender.send("timer:view", timer.view());
    event.sender.send("app:banner", banner);
    if (today) event.sender.send("today:state", today);
    event.sender.send("update:state", updateState);
  });
  ipcMain.handle("timer:act", async (event, input: unknown) => {
    if (!fromMain(event) || !timer) return { ok: false, message: "Not allowed." };
    const action = readAction(input);
    if (!action) return { ok: false, message: "That timer action isn't valid." };
    return timer.act(action);
  });
  ipcMain.on("timer:refresh", (event) => {
    if (fromMain(event)) void timer?.flush();
  });
  ipcMain.on("notice:dismiss", (event, id: unknown) => {
    if (fromMain(event) && typeof id === "string" && id.length <= 64) timer?.dismissNotice(id);
  });
  ipcMain.handle("banner:choose", (event, input: { kind?: unknown; choice?: unknown }) => {
    if (!fromMain(event)) return { ok: false, message: "Not allowed." };
    return chooseBanner(input?.kind, input?.choice);
  });
  ipcMain.on("today:refresh", (event) => {
    if (fromMain(event)) void loadToday(QUICK_RETRY_DELAYS, true);
  });
  ipcMain.on("today:stop-reminders", (event) => {
    if (!fromMain(event)) return;
    stopRemindersToday();
    log("info", "Project reminders stopped for today");
  });
  ipcMain.handle("task:action", async (event, input: { action?: unknown; taskId?: unknown }) => {
    if (!fromMain(event)) return { ok: false, message: "Not allowed." };
    const action = input?.action;
    const taskId = typeof input?.taskId === "string" ? input.taskId : "";
    if (action !== "complete" && action !== "start-timer" && action !== "stop-timer") return { ok: false, message: "Unknown action." };
    if (!ID_PATTERN.test(taskId)) return { ok: false, message: "Unknown task." };
    if (action === "stop-timer") return stopTimer("USER");
    const result = await postTaskAction(action, taskId);
    // Whatever changed (a timer started from the briefing, a task closed), refresh both tabs.
    if (result.ok) {
      void timer?.flush();
      void loadToday(QUICK_RETRY_DELAYS, true);
    }
    return result;
  });
  ipcMain.on("open-url", (event, url: unknown) => {
    if (fromMain(event) || fromSetup(event)) void openExternalSafely(url);
  });
  ipcMain.on("app:open-panel", (event, page: unknown) => {
    if (!fromMain(event) || typeof page !== "string" || !PANEL_PAGES[page]) return;
    const server = getServerUrl();
    if (server) void openExternalSafely(new URL(PANEL_PAGES[page], server).toString());
  });
  ipcMain.on("app:open-settings", (event) => {
    if (fromMain(event)) openSetup();
  });
  ipcMain.on("update:install", (event) => {
    if (fromMain(event)) void installUpdate();
  });
  ipcMain.on("update:later", (event) => {
    if (!fromMain(event)) return;
    snoozeUpdatePrompt(Date.now() + UPDATE_SNOOZE_MS);
    sendUpdate(null);
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
      // Show the tracker straight away so the person sees it working.
      void timer?.flush();
      void loadToday(QUICK_RETRY_DELAYS, true);
      showWindow("timer");
      return { ok: true, message: "Saved. The time tracker is connected." };
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
