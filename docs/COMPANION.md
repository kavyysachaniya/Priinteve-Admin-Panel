# Desktop Time Tracker (Companion)

A Windows tray app with two jobs:
- **Time tracker.** Start, pause, resume and stop task timers that live on the panel's server. It keeps working offline and survives restarts and crashes. While a timer is open it **won't let Windows shut down or restart** until the timer is stopped.
- **Daily briefing.** Website health, Slack errors, Gmail across several accounts, and the day's tasks.

Each person configures it on the panel's **Planner → Companion** page. The panel runs every check and stores every timestamp on the server; the app journals actions, sends them, and shows the result.

> [!TIP]
> **The Companion page has a short setup guide for team members** (install, pair, personalise, connect Gmail) with live ticks. The one-time server setup (Slack, Google, S3, environment variables) is in this document, under [Setup for the admin](#setup-for-the-admin).

> [!NOTE]
> Draft replies are **not** implemented. Gmail access is read-only (`gmail.readonly`), and email ranking is rule-based (no AI model).

**Contents:**
- [How it fits together](#how-it-fits-together)
- [For team members](#for-team-members)
- [Desktop time tracker](#desktop-time-tracker)
- [Shutdown and restart protection](#shutdown-and-restart-protection)
- [Desktop app behaviour](#desktop-app-behaviour)
- [What the briefing checks](#what-the-briefing-checks)
- [Team access and the installer (admins)](#team-access-and-the-installer-admins)
- [Security](#security)
- [Setup for the admin](#setup-for-the-admin)
- [Building the Windows installer](#building-the-windows-installer)
- [API contracts](#api-contracts)
- [Files](#files)
- [Testing](#testing)
- [Known limitations](#known-limitations)

---

## How it fits together

```text
Desktop app (companion/, Electron)              Panel (Next.js on Vercel)
──────────────────────────────────              ───────────────────────────────────────────
tray app, starts at Windows sign-in             /companion        setup guide + settings (session login)
                                                /dashboard        "Download for Windows" card
Timer tab                                       /timesheet        history, monthly CSV, needs-attention
  click → op written to timer-journal.jsonl
  (fsync) → POST /api/companion/timer/ops ───▶  ordered, idempotent (TimerOperation ledger)
  every 20 s: GET /api/companion/timer   ───▶   session + picker + server time; records heartbeat
Today tab                                         
  GET /api/companion/briefing            ───▶   websites / Slack / Gmail / tasks in parallel
Windows notifications: briefing, 30-min check-ins, updates
Authorization: Bearer pcd_… on every call
```

- **Per person:** settings, connected Gmail accounts, paired computers and timers all belong to the signed-in user. Nobody sees anyone else's.
- **Team-wide:** admins choose which briefing sections employees may use, and upload the installer (stored in S3, see [STORAGE.md](./STORAGE.md)).
- **Clients** (`CLIENT` role) have no access.
- **The web panel's timer keeps working.** Both use the same `ProjectTimeEntry` rows, so a timer started in the browser shows in the app within 20 seconds (and vice versa). The one-running-timer-per-person rule applies across both.

## For team members

These are the same steps as the Setup guide on the Companion page:

1. **Install.**
   - Click **Download for Windows** on the dashboard or the Companion page and run the installer.
   - It installs for your Windows user only and needs no admin rights.
   - If Windows says "Windows protected your PC", choose **More info → Run anyway**; the installer isn't code-signed.
   - An icon appears in the system tray, and the app starts with Windows from then on.
2. **Pair your computer.**
   - On the Companion page, under **Your computers**, name the computer and click **Create device token**. Copy the token; it's shown only once.
   - The app opens its settings on first run. Enter the panel address (shown in the Setup guide) and the token.
   - Click **Test connection**, then **Save**. The Timer tab fills with your projects.
3. **Personalise the briefing** (optional). Set your name, greeting, checklist, websites and Slack channels, then **Save companion settings**.
4. **Connect Gmail** (optional). Type a label and click **Connect Gmail**, then allow read access. Repeat for each account.

**Day to day:**

| You want to… | Do this |
|---|---|
| Start tracking | Timer tab → choose project and task (or **+ New task…**) → **Start timer** |
| Take a break | **Pause**, then **Resume**. Paused time is never counted |
| Work on something else | Pick the other task → **Switch task** → confirm. The first timer is stopped and saved before the new one starts |
| Finish | **Stop**, or tray icon → **Stop timer** |
| See the clock without the window | Hover the tray icon |
| See your history, reports, monthly CSV | **Time history & reports** (opens `/timesheet`) |
| See the briefing | **Today** tab, or click the morning notification |
| Close the window | ✕ hides it to the tray. While a timer is open it minimizes to the taskbar instead (see [why](#shutdown-and-restart-protection)) |
| Quit | Tray icon → **Quit** (asks you to stop an open timer first) |
| Stop it starting with Windows | Tray icon → untick **Start with Windows** |
| Stop a lost computer acting for you | Companion page → **Revoke** |

## Desktop time tracker

**The server's timestamps are the record.** The app never counts seconds and saves the count:
- Elapsed time is always `worked seconds of finished segments + (server now − current segment start)`.
- "Server now" is the server's clock from the last sync, advanced with a monotonic timer. It is re-anchored after sleep, unlock or a clock change.
- The tray tooltip and the window read the same state; neither runs its own counter.

**Every action is journaled before it is shown as done.**
- Start, pause, resume and stop each become an *op* with a random `opId` and the time of the click (`occurredAt`, on the server's clock as the app knew it).
- The op is appended to `timer-journal.jsonl` and **fsynced**, then sent. If the disk write fails the app says so and nothing changes.
- The journal survives crashes and power cuts; a torn last line is ignored on load.
- Ops are removed from the journal only after the server answers them: applied, conflict or rejected.

**Sync (`POST /api/companion/timer/ops`, `lib/services/companion/timer.ts`).**
- Ops are sent in order, up to 50 at a time, and applied in that order.
- **Idempotent.** Each `opId` goes into the `TimerOperation` ledger with its result. A retry after a lost response returns the stored result instead of starting a second session. Another account can't replay your op id.
- **Live vs queued.** An op within 15 s of the server clock takes effect *now* (so a wrong PC clock can't skew it). An older op (queued offline) takes effect at its recorded time, clamped so it is never in the future and never before the segment it closes. Such rows get `source = DESKTOP_OFFLINE` and show "synced late" on the timesheet.
- **Conflicts are reported, never guessed.**
  - A queued START older than a timer started elsewhere since then is a CONFLICT and isn't applied.
  - A STOP that names an older session leaves the newer one running.
  - Conflicts and rejections appear under **Needs your attention** in the Timer tab, with a link to the time history.
- Every rule of the panel still applies: the same `startProjectTimer` / `pauseProjectTimer` / `resumeProjectTimer` / `stopProjectTimer` functions run, inside a Serializable transaction.
- **Retries.** When the server can't be reached the status pill shows **Offline · N to sync** and the app retries after 5, 15, 30, then every 60 s, as well as on wake and unlock.
- **Token problems.** A revoked token shows **Not signed in**; journaled actions are kept until the computer is paired again.

**Switching tasks** stops and records the first session (`stopReason = SWITCH`) in the same transaction that starts the second. If the stop can't be applied, the start isn't either.

**Interrupted sessions.**
- Each 20-second poll records a heartbeat on the running segment (`lastHeartbeatAt`, at most once a minute). The poll returns the heartbeat from *before* it.
- If the gap is over 3 minutes, the PC was off, asleep, crashed or the app was closed while the timer ran. The app then asks:
  - **I was working, keep it.** Nothing changes.
  - **Stop at <last confirmed time>.** The segment ends at the last heartbeat. It is marked `interrupted`, gets `stopReason = RECOVERY`, and a `TimeEntryCorrection` (action `RECOVERY`) records who chose it and the values before and after.
  - **Stop now.**
- Nothing is chosen automatically, and the same gap isn't asked about twice.
- Timers started only in the browser have no heartbeat and are never questioned.

## Shutdown and restart protection

While a timer is running **or paused**, the app refuses a normal Windows shutdown, restart or sign-out:

1. Windows sends `WM_QUERYENDSESSION`. The app's window (Electron `query-session-end`) calls `preventDefault()`, so Windows shows its *"These apps are preventing shutdown"* screen.
2. On that screen the app's reason reads: *"Your Priinteve timer is still running. Stop your active task timer before shutting down this PC."* It is set with `ShutdownBlockReasonCreate` (user32 via `koffi`) whenever a timer is open, and removed when it isn't.
3. The app window comes to the front with **Return to Timer** and **Stop Timer and Continue**. Repeated shutdown attempts never stack prompts.
4. **Stop Timer and Continue:**
   - The stop (`stopReason = SHUTDOWN`) is fsynced to the journal first.
   - The app then tries to sync for up to 5 seconds and says either *"stopped and saved"* or *"saved on this PC; it will sync the next time you're online"*.
   - The block is lifted. Choose **Shut down** or **Restart** again. An app can't re-issue the request itself, and it can't tell restart from shutdown.
5. With no timer open the app never delays a shutdown.

**The window must be visible.** Microsoft: *"the system does not allow console applications or applications without a visible window to cancel shutdown. These applications are automatically terminated … if they return FALSE in response to WM_QUERYENDSESSION"* ([Shutdown Changes for Windows Vista](https://learn.microsoft.com/en-us/windows/win32/shutdown/shutdown-changes-for-windows-vista)).
- In 0.1.0, closing the window hid it to the tray. Windows then forced the restart about a second after the app refused, and the log showed `Blocked session end` followed by `Session ending (critical)`.
- Since 0.1.1, while a timer is open:
  - ✕ only **minimizes** the window to the taskbar;
  - if a timer opens while the window is hidden (for example, started in the browser), the app brings it back minimized, without taking focus.
  - A minimized window counts as visible, so Windows waits and shows its screen.

**If Windows ends the session anyway.** This covers "Restart anyway" or a forced or critical end. The app writes `session-ended.json` with the time, synchronously, before it is closed. On the next start it shows the [interrupted-session prompt](#desktop-time-tracker) with that time as the last confirmed activity, however short the restart was. The timer itself is never stopped by the session end.

**Quit and updates are guarded the same way.** Tray → **Quit** asks you to stop an open timer first. An update download won't install while a timer is open.

**What can't be blocked.** These still end the session:
- a forced shutdown (`shutdown /s /f`, choosing **Shut down anyway** on Windows' screen, or Windows' own timeout);
- a critical shutdown (battery, `critical` reason);
- power loss or holding the power button;
- killing the process.

The timer isn't marked stopped because a shutdown was requested. On the next start the [interrupted-session prompt](#desktop-time-tracker) handles it.

## Desktop app behaviour

- **First run.** A fresh install isn't paired, so it opens its settings window straight away, with the panel address filled in.
- **Window.** One normal window (400 × 640, resizable) with **Timer** and **Today** tabs. Its position is remembered.
  - With no timer open, ✕ hides the window to the tray.
  - While a timer is open, ✕ minimizes it to the taskbar, and a notification explains why the first time. Shutdown blocking needs a visible window.
  - Clicking the tray icon, or starting the app again, brings it back.
- **At Windows sign-in** (`--autostart`) the app stays in the tray and prepares the briefing, then shows a notification ("Good morning …") that opens the Today tab. If a timer is open, the window opens on the Timer tab.
- **Tray menu:**
  - the timer status;
  - Open time tracker;
  - Stop timer;
  - Today's briefing;
  - Open settings;
  - Start with Windows;
  - Project reminders;
  - Quit.
- **Today tab.** The briefing sections with ✓ (done), Start and Stop buttons on task rows. Done and Start call `POST /api/companion/task`; Stop goes through the timer journal. Refresh (⟳) skips the server cache.
- **Once-a-day checks.** The first briefing of the day also runs the Websites, Slack and Email checks. Each appears **only if it has something new or important**. The app sends `?daily=1` on that first request; an offline copy doesn't count.
- **Project reminders.** At :00 and :30 during your work hours (set per person on the Companion page; default 10:00–19:00, Monday to Saturday, on your computer's clock) the app asks the panel for a check-in. If there's something to say, it shows a notification that opens the Today tab.
  - **No more check-ins today** pauses until tomorrow.
  - The tray's **Project reminders** switch pauses until turned back on.
- **Auto-update.** The app checks 60 seconds after start and every 6 hours (installed copies only). A newer installer shows a notification and an *Install now / Later* strip in the window.
  - **Install now:** it gets a fresh 10-minute link, downloads, **verifies size and SHA-256**, runs the installer silently and restarts. A file that fails the check is deleted and never run.
  - **An open timer must be stopped first.**
  - **Later:** asks again in 6 hours.
  - **For admins:** keep the installer's file name `Priinteve-Companion-Setup-x.y.z.exe`. The version comes from the name. Only a strictly newer version is offered, so bump `version` in `companion/package.json` before each build.

## What the briefing checks

| Section | Source | Result |
|---|---|---|
| **Websites** | `GET` each URL, 8-second limit, up to 5 redirects | Up (≤ 3 s), **slow** (> 3 s, amber), **client error** (4xx, amber), **down** (5xx, timeout or no connection, red) |
| **Slack** | `conversations.history` for the last 24 h in your channels, through the workspace bot | Count of messages with an error keyword (whole word, case-insensitive, attachment text included), with the latest one as a short sample and a link to it. Red if any. |
| **Email** | Gmail API, read-only, per connected account | Inbox unread count, how many important messages arrived **yesterday** (in your time zone), and the top 5 across all accounts, each linking to the thread |
| **Today** | The panel's task planner | Your checklist, then overdue, today's and tomorrow's open tasks. "My tasks" = assigned to you or tagged; admins can choose "All team tasks". |

**Email ranking.** Scores come from headers and labels only (`lib/services/companion/email-scoring.ts`):

| Signal | Points |
|---|---|
| VIP sender (address or `@domain` you listed) | +5 |
| Urgent keyword in the subject (default: payment, invoice, order, deadline) | +3 |
| Sent directly to you (`To`) / only in `Cc` | +2 / +1 |
| Awaiting your reply (newest message in the thread isn't yours; top 10 threads checked) | +2 |
| Gmail Important / starred | +1 each |
| Newsletter, promotion or automated (Promotions/Social/Updates/Forums, `List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted`, no-reply senders) | capped below all personal mail; never important |

A score of 3 or more counts as important. Mark an inbox **Private** to report its unread count only.

**Failures never block the briefing.** Each section runs in parallel with a 25-second limit. A failure or timeout shows as an amber "check unavailable" item, and expired Gmail access shows an amber **reconnect** item.

**Caching.** The server keeps each briefing for 60 seconds per instance. **Refresh** in the app skips this cache.

## Team access and the installer (admins)

**Team access** (`companion:manage`), at the bottom of the Companion page:

| Switch | Default | Employees may… |
|---|---|---|
| Website checks | On | add websites to monitor |
| Slack errors | On | watch Slack channels the bot is in |
| Gmail | On | connect their own Gmail |

Tasks and the checklist are always on, and admins always have every section. Switching a section off hides it from employees' pages and briefings, and the Gmail connect route refuses new connections.

**Desktop app installer.**
- Upload the `.exe` (up to 500 MB) on the Companion page. Uploading again replaces it.
- Everyone with `companion:use` then gets **Download for Windows** on the dashboard and on the Companion page. Both go through `/api/companion/installer`, which re-checks the permission and redirects to a 5-minute S3 link.
- The file is stored in S3 ([STORAGE.md](./STORAGE.md)), so S3 must be configured.

## Security

- **Device tokens:**
  - The format is `pcd_<deviceId>_<32 random bytes>`.
  - Only a SHA-256 hash is stored, and comparison is constant-time.
  - A token stops working when the device is revoked, the user is deactivated, or their role loses `companion:use`.
  - The app keeps it encrypted with Windows DPAPI (Electron `safeStorage`).
- **Session-check bypass.** These exact paths skip the session check in `proxy.ts` and check the bearer token themselves:
  - `/api/companion/briefing`
  - `/api/companion/reminder`
  - `/api/companion/update`
  - `/api/companion/task`
  - `/api/companion/live`
  - `/api/companion/timer`
  - `/api/companion/timer/ops`

  Everything else requires a signed-in session.
- **Timer permissions are enforced on the server.**
  - Ops need `projects:timer` (new tasks also need `tasks:create`).
  - The assignment, ownership and one-timer rules of the panel apply unchanged.
  - Op ids are bound to the account that first sent them.
- **Gmail refresh tokens** are AES-256-GCM encrypted (`lib/crypto.ts`, key `COMPANION_ENCRYPTION_KEY`) and never sent to the browser or the app.
- **Integration secrets** (`SLACK_BOT_TOKEN`, Google client secret, S3 keys) live only in environment variables.
- **OAuth `state`:** random, kept in a 10-minute httpOnly cookie tied to the user, and compared in constant time. Provider error text is never echoed back to the page.
- **Website checks refuse private addresses:** loopback, private, link-local, CGNAT and multicast, re-checked on every redirect. This stops team members probing internal systems through the server.
  - `COMPANION_ALLOW_PRIVATE_URLS=true` lifts the block in development only.
- **Logging:** only the integration name and error codes are logged. Email bodies are never requested, and subjects and Slack text are never logged.
- **Input:** all settings are validated with Zod (`lib/validations/companion.ts`) with caps: 20 sites, 10 channels, 30 keywords, 50 VIPs, 15 checklist items, 10 active devices per person.
  - Timer ops are validated by `lib/validations/companion-timer.ts`: at most 50 per request.
- **Desktop app:**
  - Sandboxed windows, context isolation, no Node integration, strict CSP, and navigation blocked.
  - Every IPC message is checked against the sending window and its payload re-validated (ids by pattern, actions from a fixed list).
  - No IPC message runs a command.
  - Only `http(s)` links open, in the default browser; panel pages open only from a fixed list.
  - It never crashes on network or file errors.

## Setup for the admin

### 1. Environment variables

| Variable | Needed for | Value |
|---|---|---|
| `APP_URL` | Links and OAuth redirects | Public panel URL, no trailing slash. Falls back to `NEXTAUTH_URL`, then the request origin. |
| `APP_TIMEZONE` | Timesheet days, months and CSV times | IANA zone, default `Asia/Kolkata` |
| `COMPANION_ENCRYPTION_KEY` | Gmail connections | 32 random bytes, base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Never change it**: every Gmail account would need reconnecting. |
| `SLACK_BOT_TOKEN` | Slack section | The bot's `xoxb-…` token |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail | Google OAuth client |
| `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Installer download (and task attachments) | See [STORAGE.md](./STORAGE.md) |
| `COMPANION_ALLOW_PRIVATE_URLS` | Development only | `true` lets website checks reach localhost/LAN |

### 2. Database

The companion adds these tables (see [DATABASE.md](./DATABASE.md#companion)):
- `CompanionSettings`, `CompanionTeamPolicy`, `CompanionDevice` and `CompanionGmailAccount`, plus two columns on `Attachment`;
- for the timer, `TimerOperation`, `TimeEntryCorrection` and the session columns on `ProjectTimeEntry`.

To apply them:
- **Locally:** `npm run db:push` (stop `npm run dev` first on Windows). It also re-applies the one-active-timer index. For data from before sessions existed, run `npx tsx scripts/backfill-time-sessions.ts` once.
- **On Vercel:** the build command runs `prisma db push` automatically. Run `npm run db:index` against production once if the index is missing.

### 3. Slack bot

1. At <https://api.slack.com/apps>, choose **Create New App → From scratch** and name it, for example "Priinteve Companion".
2. Under **OAuth & Permissions → Bot Token Scopes**, add `channels:history`, plus `groups:history` for private channels.
3. Click **Install to Workspace** and copy the `xoxb-…` token into `SLACK_BOT_TOKEN`.
4. In each channel to watch, run `/invite @Priinteve Companion`.

People add channels by **ID**: click the channel name and copy the ID at the bottom (it starts with `C`).

> [!NOTE]
> One shared bot means anyone allowed the Slack section can watch any channel the bot is in. Invite it only to channels the whole team may see.

### 4. Google Cloud project (Gmail)

1. At <https://console.cloud.google.com>, create a project and enable the **Gmail API**.
2. Set up the **OAuth consent screen**:
   - user type **Internal** (Workspace) or **External**;
   - add only the `https://www.googleapis.com/auth/gmail.readonly` scope;
   - in Testing mode, add each person under **Test users**.
3. Under **Credentials → OAuth client ID → Web application**, add the authorised redirect URIs:
   - `https://<your-panel>/api/companion/google/callback`
   - `http://localhost:3000/api/companion/google/callback`
4. Put the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Apps in Testing mode expire refresh tokens after 7 days (shown as "reconnect needed"). Publishing the app removes that; `gmail.readonly` is a restricted scope, so External apps need Google verification.

### 5. File storage

Follow [STORAGE.md](./STORAGE.md#bucket-setup):
- keep the bucket private;
- add CORS for the panel origin;
- give the IAM user access.

### 6. Deploy

1. Add the variables in Vercel → Settings → Environment Variables.
2. Push to `main`.
3. Check the device routes:

   ```bash
   curl -i https://<your-panel>/api/companion/briefing
   curl -i https://<your-panel>/api/companion/timer
   ```

   Both must return **401 JSON**, not a redirect.

### 7. Installer

Build it (below), then upload it under **Desktop app installer** on the Companion page. It appears on the dashboard for everyone with Companion access.

## Building the Windows installer

```bash
cd companion
npm install
npm test          # journal + sync checks (no Electron, no network)
npm run dist      # → companion/release/Priinteve-Companion-Setup-<version>.exe
```

| Command (in `companion/`) | Does |
|---|---|
| `npm run sample` | Runs with a built-in sample briefing (no server) |
| `npm start` | Builds and runs against the configured server |
| `npm test` | Builds, then runs `scripts/test-timer.mjs` |
| `npm run typecheck` | Type-checks the main process and the renderer |
| `npm run icon` | Redraws the tray/installer icons (only after changing the shape) |
| `npm run dist` | Builds the NSIS installer (per-user, x64) |

- **Installer behaviour:** it installs to `%LOCALAPPDATA%\Programs\`. The first run turns on **Start with Windows**.
- **koffi:** the native library behind the shutdown-block reason is unpacked from the asar (`asarUnpack` in `electron-builder.yml`). If it can't load, blocking still works but Windows shows only the app name.
- **App data** lives in `%APPDATA%\Priinteve Companion\`:
  - `config.json`, `state.json`, `briefing-cache.json`, `companion.log`;
  - `timer-journal.jsonl`: unsent timer actions; **don't delete** while it has lines;
  - `timer-state.json`: the last server state, the clock offset, notices and answered interruptions.
- **Updates:** bump `version` in `companion/package.json`, rebuild and upload the new `.exe`. Computers that already have the app offer the update themselves; installing over the old version keeps settings and the journal.
- **Signing:** set `CSC_LINK` / `CSC_KEY_PASSWORD` to code-sign.
- **Developing from VS Code's terminal:** unset `ELECTRON_RUN_AS_NODE` first, or Electron starts as plain Node.

**Network for the briefing:**
- At startup it makes 6 attempts over about a minute (waits of 0, 2, 5, 10, 20 and 30 s; 15 s per request).
- If every attempt fails, the last cached briefing is shown with an "Offline" note.

## API contracts

**`GET /api/companion/briefing`**
- Header: `Authorization: Bearer pcd_…`.
- Optional query: `?fresh=1` skips the cache; `?daily=1` adds the once-a-day checks.
- Responses: **401** for a bad token; **200** with:

```json
{
  "generatedAt": "2026-10-05T02:00:00.000Z",
  "mascotName": "Inky",
  "ownerName": "Tarang",
  "greeting": "Good morning",
  "summary": "All 3 sites are up, 2 important emails from yesterday, 4 tasks today.",
  "mood": "happy | neutral | worried",
  "sections": [
    {
      "key": "websites | slack | gmail | tasks",
      "title": "Websites",
      "status": "ok | warn | error | todo",
      "items": [{ "label": "Main site", "detail": "Up · 412 ms", "status": "ok", "url": "https://…" }]
    }
  ]
}
```

`mascotName` and `mood` are still sent for older app versions; 0.1.0 doesn't show them.

**`GET /api/companion/timer`** returns `{ session, projects, canCreateTasks, serverTime }`.
- `session`: `null`, or the open session: `entryId`, `sessionId`, `status` (`RUNNING`/`PAUSED`), project and task, `sessionStartedAt`, `segmentStartedAt`, `pausedAt`, `closedSeconds` (worked seconds in finished segments), `lastHeartbeatAt` (before this poll).
- `projects`: projects you may track on, each with up to 50 open tasks.

**`POST /api/companion/timer/ops`** takes `{ ops: [...] }`, 1–50 ops. Each op has:
- `opId` and `occurredAt`;
- `type`: `START` (`projectId`, and `taskId` or `newTaskTitle`), `PAUSE`, `RESUME` (`projectId`), or `STOP` (optional `sessionId`, `stopReason` `USER`/`SWITCH`/`SHUTDOWN`/`RECOVERY`, `note`).

It answers `{ ok, results: [{ opId, status: APPLIED|CONFLICT|REJECTED, message }], state }`.

**Shared types** must stay in sync with the app's re-validating parsers:
- `lib/services/companion/types.ts` ↔ `companion/src/shared/briefing.ts`;
- `lib/services/companion/timer.ts` and `lib/validations/companion-timer.ts` ↔ `companion/src/shared/timer.ts`.

## Files

| Area | Files |
|---|---|
| Page | `app/(app)/companion/`; dashboard card `components/dashboard/desktop-app-card.tsx` |
| UI | `components/companion/*`: `setup-guide.tsx` is the in-page guide |
| Actions / validation | `lib/actions/companion.ts`, `lib/validations/companion.ts`, `lib/validations/companion-timer.ts` |
| Services | `lib/services/companion/`: `timer.ts` (desktop ops), `settings.ts`, `devices.ts`, `accounts.ts`, `installer.ts`, `reminder.ts`, `task-actions.ts`, `task-rows.ts`, `live.ts`, `versions.ts`, `briefing.ts`, `net.ts`, `time.ts`, `email-scoring.ts`, `google.ts`, `oauth-state.ts` |
| Integrations | `lib/services/companion/integrations/`: `websites.ts`, `slack.ts`, `gmail.ts`, `tasks.ts` |
| API | `app/api/companion/`: `briefing`, `reminder`, `update`, `task`, `live`, `timer`, `timer/ops`, `installer`, `google/{connect,callback}` |
| Shared | `lib/crypto.ts`, `lib/services/storage.ts`, `listOpenTasksDueBefore()` in `lib/services/tasks.ts` |
| Desktop app | `companion/`; `src/main/timer.ts` (controller), `journal.ts`, `shutdown.ts`, `main.ts` (window, tray, IPC); `src/renderer/app.ts` (window). See `companion/README.md` |

## Testing

- **Offline checks:** `npx tsx scripts/test-companion.ts` needs no database or network. Among other things it covers:
  - version comparison, installer file names, task due instants, work-hour checks, reminder tick timing and update-payload validation;
  - email scoring;
  - time-zone days;
  - private-address blocking;
  - Slack matching;
  - encryption;
  - website classification against a local server.
- **Desktop timer logic:** `cd companion && npm test`. It covers:
  - the journal surviving reloads, acks and a torn line;
  - an offline start surviving a restart;
  - a lost response retried without a duplicate session;
  - paused time not counted;
  - offline stop → restart → sync;
  - the interrupted-session prompt shown once.
- **Desktop ops on the server:** `npx tsx scripts/test-timer-ops.ts` (writes to the `.env` database and cleans up). It covers:
  - idempotent replay, and op ids bound to their account;
  - offline batches keeping their times and excluding paused time;
  - stale-start conflicts and switching;
  - stale stops;
  - recovery with an audit row;
  - unassigned users rejected.
- **Desktop app UI:** `cd companion && npm run sample`, or `npm start` against a local panel.

**Manual Windows checklist** (installed build; shutdown handling can't be simulated):

| # | Do | Expect |
|---|---|---|
| 1 | No timer → Start → Shut down | Shuts down normally, no prompt |
| 2 | Timer running → Shut down | Windows lists the app with the reason text; the app shows the prompt |
| 3 | Same, with Restart | Same as 2 |
| 4 | Choose **Return to Timer** | Prompt closes, timer still running, shutdown cancelled |
| 5 | Choose **Stop Timer and Continue**, then Shut down again | "Stopped and saved"; the second shutdown proceeds |
| 6 | Disable the network adapter, repeat 5 | "Saved on this PC"; after the next start online the entry appears with `stopReason SHUTDOWN` |
| 7 | Click Shut down several times while blocked | One prompt, one stop |
| 8 | Timer running → kill the app in Task Manager → wait 4 min → start it | Interrupted-session prompt with the last confirmed time |
| 9 | Timer running → sleep the PC 10 min → wake | Interrupted-session prompt (sleep gap) |
| 10 | Timer running → tray → Quit | Quit prompt; **Stop timer & quit** stops then exits |

## Known limitations

- **Forced shutdowns can't be blocked:** power loss, a held power button, `shutdown /f`, "Shut down anyway", a critical battery, or killing the process. They're caught by the interrupted-session prompt on the next start, never by inventing a stop time.
- **After "Stop Timer and Continue" you start the shutdown again yourself.** Windows doesn't let an app resume it, or tell a restart from a shutdown.
- **A paused session also blocks shutdown.** Stop it to shut down.
- **While a timer is open, the window stays in the taskbar** (minimized) rather than only in the tray. Windows ignores a shutdown refusal from an app with no visible window.
- **The heartbeat needs the app running.** Timers started in the browser are never flagged as interrupted.
- **No reply drafting and no AI.**
- **The 60-second briefing cache is per server instance.**
- **Website checks don't pin DNS** between the address check and the request (DNS rebinding isn't caught).
- **Unsigned installer:** SmartScreen warns on first install.
