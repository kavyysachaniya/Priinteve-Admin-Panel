import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

// The only bridge between the sandboxed pages and the main process.

contextBridge.exposeInMainWorld("companion", {
  // Briefing window
  onState: (callback: (state: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on("briefing:state", listener);
    return () => ipcRenderer.removeListener("briefing:state", listener);
  },
  ready: () => ipcRenderer.send("briefing:ready"),
  dismiss: () => ipcRenderer.send("briefing:dismiss"),
  remindLater: () => ipcRenderer.send("briefing:remind"),
  refresh: () => ipcRenderer.send("briefing:refresh"),
  openUrl: (url: string) => ipcRenderer.send("open-url", url),
  showMenu: () => ipcRenderer.send("briefing:menu"),
  dragStart: () => ipcRenderer.send("briefing:drag-start"),
  dragMove: (dx: number, dy: number) => ipcRenderer.send("briefing:drag-move", dx, dy),
  dragEnd: () => ipcRenderer.send("briefing:drag-end"),
  onUi: (callback: (state: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on("ui:state", listener);
    return () => ipcRenderer.removeListener("ui:state", listener);
  },
  dockChanged: (docked: boolean) => ipcRenderer.send("briefing:docked", docked),
  stopToday: () => ipcRenderer.send("briefing:stop-today"),
  onUpdate: (callback: (state: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on("update:state", listener);
    return () => ipcRenderer.removeListener("update:state", listener);
  },
  installUpdate: () => ipcRenderer.send("update:install"),
  laterUpdate: () => ipcRenderer.send("update:later"),
  reportHits: (rects: Array<{ x: number; y: number; w: number; h: number }>) => ipcRenderer.send("briefing:hit-rects", rects),
  watchTasks: (ids: string[]) => ipcRenderer.send("briefing:watch-tasks", ids),
  onLive: (callback: (state: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on("live:state", listener);
    return () => ipcRenderer.removeListener("live:state", listener);
  },
  taskAction: (action: string, taskId: string) => ipcRenderer.invoke("task:action", { action, taskId }),
  setInteractive: (interactive: boolean) => ipcRenderer.send("briefing:interactive", interactive),

  // Settings window
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (input: { serverUrl: string; token: string }) => ipcRenderer.invoke("settings:save", input),
  testConnection: (input: { serverUrl: string; token: string }) => ipcRenderer.invoke("settings:test", input),
  openPanel: () => ipcRenderer.send("settings:open-panel"),
});
