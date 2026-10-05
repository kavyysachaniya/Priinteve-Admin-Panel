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
  setInteractive: (interactive: boolean) => ipcRenderer.send("briefing:interactive", interactive),

  // Settings window
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (input: { serverUrl: string; token: string }) => ipcRenderer.invoke("settings:save", input),
  testConnection: (input: { serverUrl: string; token: string }) => ipcRenderer.invoke("settings:test", input),
  openPanel: () => ipcRenderer.send("settings:open-panel"),
});
