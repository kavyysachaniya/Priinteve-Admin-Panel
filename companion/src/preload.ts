import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

// The only bridge between the sandboxed pages and the main process. The main process checks
// which window every message came from and validates every payload.

function subscribe(channel: string) {
  return (callback: (state: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld("companion", {
  // App window
  ready: () => ipcRenderer.send("app:ready"),
  onTimer: subscribe("timer:view"),
  onBanner: subscribe("app:banner"),
  onToday: subscribe("today:state"),
  onTab: subscribe("app:tab"),
  onUpdate: subscribe("update:state"),
  timerAction: (input: unknown) => ipcRenderer.invoke("timer:act", input),
  refreshTimer: () => ipcRenderer.send("timer:refresh"),
  dismissNotice: (id: string) => ipcRenderer.send("notice:dismiss", id),
  chooseBanner: (kind: string, choice: string) => ipcRenderer.invoke("banner:choose", { kind, choice }),
  refreshToday: () => ipcRenderer.send("today:refresh"),
  stopToday: () => ipcRenderer.send("today:stop-reminders"),
  taskAction: (action: string, taskId: string) => ipcRenderer.invoke("task:action", { action, taskId }),
  openUrl: (url: string) => ipcRenderer.send("open-url", url),
  openPanelPage: (page: string) => ipcRenderer.send("app:open-panel", page),
  openSettings: () => ipcRenderer.send("app:open-settings"),
  installUpdate: () => ipcRenderer.send("update:install"),
  laterUpdate: () => ipcRenderer.send("update:later"),

  // Settings window
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (input: { serverUrl: string; token: string }) => ipcRenderer.invoke("settings:save", input),
  testConnection: (input: { serverUrl: string; token: string }) => ipcRenderer.invoke("settings:test", input),
  openPanel: () => ipcRenderer.send("settings:open-panel"),
});
