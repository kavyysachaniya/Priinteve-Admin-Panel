# Priinteve Companion (Windows desktop app)

An ink-drop mascot that slides in at the bottom-right of the screen each morning with your briefing from the Priinteve panel.

**Full guide:** [docs/COMPANION.md](../docs/COMPANION.md). It covers the team setup, the Slack, Google and Meta configuration, the environment variables and deployment.

```bash
npm install
npm run sample     # try it with built-in sample data, no server needed
npm start          # run against your panel (tray icon → Open settings to pair)
npm run typecheck
npm run dist       # build the installer → release/Priinteve-Companion-Setup-<version>.exe
```

**Layout:**
- `src/main/`: main process.
  - `main.ts`: tray, autostart, daily logic, IPC.
  - `windows.ts`: transparent bottom-right window, settings window.
  - `api.ts`: fetch with retries, falling back to the cache.
  - `store.ts`: config with the DPAPI-encrypted token, daily state, cache.
  - `log.ts`: the local log.
- `src/preload.ts`: the only bridge to the sandboxed pages.
- `src/renderer/`: the mascot (inline SVG + CSS animations), the speech bubble, and the settings window.
- `src/shared/briefing.ts`: the briefing contract. Keep it in sync with `lib/services/companion/types.ts` in the panel.
- `scripts/make-icon.mjs`: draws the tray and installer icons. Its output is committed in `assets/` and `build/`.

The app stores no integration secrets: only the panel address and its own device token, encrypted with Windows DPAPI.
