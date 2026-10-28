# Priinteve Time Tracker (Windows desktop companion)

A tray app with a timer window (Timer and Today tabs). It tracks time on panel tasks, keeps working offline, refuses a Windows shutdown while a timer is open, and shows the morning briefing.

**Full guide:** [docs/COMPANION.md](../docs/COMPANION.md). It covers how the timer syncs, shutdown protection and its limits, team setup, the Slack and Google configuration, the environment variables, deployment and the manual Windows checklist.

```bash
npm install
npm run sample     # try it with a built-in sample briefing, no server needed
npm start          # run against your panel (pair it in the settings window)
npm test           # journal + sync checks, no Electron or network
npm run typecheck
npm run dist       # build the installer → release/Priinteve-Companion-Setup-<version>.exe
```

From VS Code's terminal, run `unset ELECTRON_RUN_AS_NODE` (bash) first, or Electron starts as plain Node.

**Layout:**
- `src/main/`: main process.
  - `main.ts`: window, tray, notifications, autostart, quit/shutdown/update guards, IPC.
  - `timer.ts`: the timer controller (projection of server state plus pending actions, sync loop, interrupted-session check).
  - `journal.ts`: the fsynced append-only journal of unsent timer actions.
  - `shutdown.ts`: `query-session-end` handling and `ShutdownBlockReasonCreate` via `koffi`.
  - `server.ts`, `api.ts`: panel calls (device token), the briefing with retries and cache.
  - `windows.ts`: the app window and the settings window.
  - `store.ts`: config with the DPAPI-encrypted token, daily state, cache.
  - `reminders.ts`, `updater.ts`, `log.ts`.
- `src/preload.ts`: the only bridge to the sandboxed pages.
- `src/renderer/`: `index.html` + `app.ts` + `app.css` (timer window), `setup.*` (settings).
- `src/shared/`: `briefing.ts` and `timer.ts`, the contracts with the panel. Keep them in sync with `lib/services/companion/`.
- `scripts/test-timer.mjs`: offline tests for the journal and controller.
- `scripts/make-icon.mjs`: draws the tray and installer icons. Its output is committed in `assets/` and `build/`.

The app stores no integration secrets: only the panel address and its own device token, encrypted with Windows DPAPI. Timer data lives in `%APPDATA%\Priinteve Companion\timer-journal.jsonl` (unsent actions) and `timer-state.json`.
