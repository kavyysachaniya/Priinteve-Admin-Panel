// Settings window: panel address + device token. The token is never shown back.
(() => {
  const bridge = window.companion;
  const form = document.getElementById("form") as HTMLFormElement;
  const server = document.getElementById("server") as HTMLInputElement;
  const token = document.getElementById("token") as HTMLInputElement;
  const tokenHint = document.getElementById("token-hint") as HTMLElement;
  const status = document.getElementById("status") as HTMLElement;
  const testBtn = document.getElementById("test") as HTMLButtonElement;
  const openPanel = document.getElementById("open-panel") as HTMLButtonElement;
  const heading = document.getElementById("heading") as HTMLElement;
  const intro = document.getElementById("intro") as HTMLElement;

  function show(result: SettingsResult) {
    status.textContent = result.message;
    status.className = `status ${result.ok ? "ok" : "error"}`;
  }

  async function busy<T>(fn: () => Promise<T>): Promise<T> {
    for (const b of document.querySelectorAll("button")) b.disabled = true;
    try {
      return await fn();
    } finally {
      for (const b of document.querySelectorAll("button")) b.disabled = false;
    }
  }

  void bridge.getSettings().then((settings) => {
    if (!settings) return;
    server.value = settings.serverUrl;
    if (!settings.hasToken) {
      heading.textContent = "Welcome to Priinteve Companion";
      intro.textContent =
        "Let's connect this computer. In the panel, open Planner > Companion, create a device token, and paste it below.";
    }
    if (settings.hasToken) {
      token.placeholder = "Saved (leave blank to keep it)";
      tokenHint.textContent = "A token is saved. Paste a new one only to re-pair this computer.";
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void busy(async () => {
      const result = await bridge.saveSettings({ serverUrl: server.value, token: token.value });
      show(result);
      if (result.ok) token.value = "";
    });
  });

  testBtn.addEventListener("click", () => {
    status.textContent = "Testing…";
    status.className = "status";
    void busy(async () => show(await bridge.testConnection({ serverUrl: server.value, token: token.value })));
  });

  openPanel.addEventListener("click", () => bridge.openPanel());
})();
