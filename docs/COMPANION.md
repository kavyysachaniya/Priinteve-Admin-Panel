# Morning Companion

A Windows desktop mascot that gives each team member a morning briefing: website health, Slack errors, Gmail across several accounts, and the day's tasks. Each person configures their own companion on the panel's **Planner → Companion** page. The panel runs every check on the server; the desktop app only displays the result.

> [!TIP]
> **The Companion page has a short setup guide for team members** (install, pair, personalise, connect Gmail) with live ticks. The one-time server setup (Slack, Google, S3, environment variables) is in this document, under [Setup for the admin](#setup-for-the-admin).

> [!NOTE]
> Draft replies are **not** implemented. Gmail access is read-only (`gmail.readonly`), and email ranking is rule-based (no AI model).

**Contents:**
- [How it fits together](#how-it-fits-together)
- [For team members](#for-team-members)
- [What the briefing checks](#what-the-briefing-checks)
- [Team access and the installer (admins)](#team-access-and-the-installer-admins)
- [Security](#security)
- [Setup for the admin](#setup-for-the-admin)
- [Building the Windows installer](#building-the-windows-installer)
- [Briefing API contract](#briefing-api-contract)
- [Files](#files)
- [Testing](#testing)
- [Known limitations](#known-limitations)

---

## How it fits together

```text
Desktop app (companion/, Electron)            Panel (Next.js on Vercel)
──────────────────────────────────            ───────────────────────────────────────────
starts at Windows sign-in                     /companion          setup guide + settings (session login)
waits 6 s, then once per day:                 /api/companion/briefing
  GET /api/companion/briefing  ───────────▶     device token → user → their settings
  Authorization: Bearer pcd_…                   websites ┐ in parallel, each with a time limit;
                                                Slack    │ a failure becomes an amber
  ◀─────────── one JSON briefing ───────────    Gmail    │ "unavailable" section
shows mascot + speech bubble                    tasks    ┘
caches it for offline mornings                /api/companion/installer  → S3 download link
```

- **Per person:** settings, connected Gmail accounts and paired computers all belong to the signed-in user. Nobody sees anyone else's.
- **Team-wide:** admins choose which sections employees may use, and upload the installer (stored in S3, see [STORAGE.md](./STORAGE.md)).
- **Clients** (`CLIENT` role) have no access.

## For team members

These are the same steps as the Setup guide on the Companion page:

1. **Install.** Click **Download for Windows** on the Companion page and run the installer. It installs for your Windows user only and needs no admin rights. If Windows says "Windows protected your PC", choose **More info → Run anyway**; the installer isn't code-signed. An ink-drop icon appears in the system tray, and the app starts with Windows from then on.
2. **Pair your computer.** On the Companion page, under **Your computers**, name the computer and click **Create device token**. Copy the token; it's shown only once. In the app, right-click the tray icon → **Open settings**, then enter the panel address (shown in the Setup guide) and the token. Click **Test connection**, then **Save**.
3. **Personalise.** Set your name, greeting, checklist, websites and Slack channels, then **Save companion settings**. Changes apply on the next briefing; nothing needs reinstalling.
4. **Connect Gmail (optional).** Type a label and click **Connect Gmail**, then allow read access. Repeat for each account.

**Day to day:**

| You want to… | Do this |
|---|---|
| See the briefing again | Tray icon → **Show briefing now** (or left-click the icon) |
| Get the latest data | **Refresh** (⟳) in the bubble |
| Be reminded later | **Remind me in 30 min** |
| Close it | **Got it**, or press Esc |
| Stop it starting with Windows | Tray icon → untick **Start with Windows** |
| Open a site, email or task | Click the item |
| Stop a lost computer getting briefings | Companion page → **Revoke** |

**What the marks mean:**
- **Green tick:** healthy.
- **Amber !:** needs a look, or a check couldn't run.
- **Red ✕:** down or broken.
- **Blue ○:** to do.

The mascot looks happy when all is well and worried when something is red. With Windows **Animation effects** off, it fades in instead of sliding, waving and bobbing.

## Desktop app behaviour

- **First run.** A fresh install isn't paired, so it opens its settings window straight away, with the panel address filled in. Paste the device token, and the first real briefing appears as soon as you save. Until it's paired, the tray's "Show briefing now" opens settings too.
- **Minimise to the edge.** Click the mascot (or press Esc, or **Got it**) and it slides to the right screen edge, half visible. Click it there, or the tray icon, to open it again.
  - Right-click the mascot, the bubble or the tray icon for the menu: Show briefing now, Open settings, Start with Windows, Project reminders, Quit.
  - Clicks pass through the transparent window except over the mascot and the bubble. The app tracks the cursor against their rectangles, so it works however the mouse moves.
- **Act on tasks from the bubble.** Task rows in the briefing and the reminder have small buttons: **✓** marks the task done, **▶** starts its timer (your timer on any other task stops), and the timer row has **■** to stop the running timer. They call `POST /api/companion/task` with the device token, and the server re-checks that you can see the task and reuses the panel's own rules (clients can't track time; one running timer per person).
- **Move and resize the mascot.**
  - Press and drag the mascot to move it. Open, it moves within the screen (the position is remembered). Minimised, it slides along the right screen edge.
  - Tray or right-click menu → **Mascot size** → Small, Medium or Large (remembered).
- **Project reminders.** Every 30 minutes (at :00 and :30) during your work hours, the app asks the panel for a check-in and shows it:
  - whether a project timer is running;
  - your overdue and due-today tasks, grouped by project.

  The schedule is set per person on the Companion page (default 10:00-19:00, Monday to Saturday, on your computer's clock). It stays quiet when a timer is running and nothing is due, never covers a briefing you have open, and skips ticks when the network is down. **Stop for today** pauses it until tomorrow; the tray's **Project reminders** switch pauses it until turned back on.
- **Auto-update.** The app checks 60 seconds after start and every 6 hours (installed copies only). When a newer installer is available it shows "Update x.y.z is available: Install now / Later".
  - **Install now:** it asks the panel for a fresh 10-minute download link, downloads the installer, **verifies its size and SHA-256**, then runs it silently and restarts. A file that fails the check is deleted and never run.
  - **Later:** asks again in 6 hours.
  - **For admins:** keep the installer's file name `Priinteve-Companion-Setup-x.y.z.exe`. The version comes from the name, and the checksum is computed in the browser at upload. Only a strictly newer version is ever offered, so bump `version` in `companion/package.json` before each build.

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

**Desktop app installer.** Upload the `.exe` (up to 500 MB) and everyone with Companion access gets **Download for Windows**. Uploading again replaces it. It's stored in S3 ([STORAGE.md](./STORAGE.md)), so S3 must be configured.

## Security

- **Device tokens:**
  - The format is `pcd_<deviceId>_<32 random bytes>`.
  - Only a SHA-256 hash is stored, and comparison is constant-time.
  - A token stops working when the device is revoked, the user is deactivated, or their role loses `companion:use`.
  - The app keeps it encrypted with Windows DPAPI (Electron `safeStorage`).
- **Only `/api/companion/briefing` bypasses the session check** in `proxy.ts`, by exact path, and it checks the bearer token itself. Everything else requires a signed-in session.
- **Gmail refresh tokens** are AES-256-GCM encrypted (`lib/crypto.ts`, key `COMPANION_ENCRYPTION_KEY`) and never sent to the browser or the app.
- **Integration secrets** (`SLACK_BOT_TOKEN`, Google client secret, S3 keys) live only in environment variables.
- **OAuth `state`:** random, kept in a 10-minute httpOnly cookie tied to the user, and compared in constant time. Provider error text is never echoed back to the page.
- **Website checks refuse private addresses:** loopback, private, link-local, CGNAT and multicast, re-checked on every redirect. This stops team members probing internal systems through the server.
  - `COMPANION_ALLOW_PRIVATE_URLS=true` lifts the block in development only.
- **Logging:** only the integration name and error codes are logged. Email bodies are never requested, and subjects and Slack text are never logged.
- **Input:** all settings are validated with Zod (`lib/validations/companion.ts`) with caps: 20 sites, 10 channels, 30 keywords, 50 VIPs, 15 checklist items, 10 active devices per person.
- **Desktop app:**
  - Sandboxed windows, context isolation, no Node integration, strict CSP, and navigation blocked.
  - Only `http(s)` links open, in the default browser.
  - It never crashes on network or file errors.

## Setup for the admin

### 1. Environment variables

| Variable | Needed for | Value |
|---|---|---|
| `APP_URL` | Links and OAuth redirects | Public panel URL, no trailing slash. Falls back to `NEXTAUTH_URL`, then the request origin. |
| `COMPANION_ENCRYPTION_KEY` | Gmail connections | 32 random bytes, base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Never change it**: every Gmail account would need reconnecting. |
| `SLACK_BOT_TOKEN` | Slack section | The bot's `xoxb-…` token |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail | Google OAuth client |
| `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Installer download (and task attachments) | See [STORAGE.md](./STORAGE.md) |
| `COMPANION_ALLOW_PRIVATE_URLS` | Development only | `true` lets website checks reach localhost/LAN |

### 2. Database

The companion adds `CompanionSettings`, `CompanionTeamPolicy`, `CompanionDevice` and `CompanionGmailAccount`, plus two columns on `Attachment` (see [DATABASE.md](./DATABASE.md#companion)).
- **Locally:** `npm run db:push` (stop `npm run dev` first on Windows).
- **On Vercel:** the build command runs `prisma db push` automatically.

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
3. Check the briefing route:

   ```bash
   curl -i https://<your-panel>/api/companion/briefing
   ```

   It must return **401 JSON**, not a redirect.

### 7. Installer

Build it (below), then upload it under **Desktop app installer** on the Companion page.

## Building the Windows installer

```bash
cd companion
npm install
npm run dist      # → companion/release/Priinteve-Companion-Setup-<version>.exe
```

| Command (in `companion/`) | Does |
|---|---|
| `npm run sample` | Runs with built-in sample data (no server) |
| `npm start` | Builds and runs against the configured server |
| `npm run typecheck` | Type-checks the main process and the renderer |
| `npm run icon` | Redraws the tray/installer icons (only after changing the shape) |
| `npm run dist` | Builds the NSIS installer (per-user, x64) |

- **Installer behaviour:** it installs to `%LOCALAPPDATA%\Programs\`. The first run turns on **Start with Windows**.
- **App data:** `config.json`, `state.json`, `briefing-cache.json` and `companion.log` live in `%APPDATA%\Priinteve Companion\`.
- **Updates:** bump `version` in `companion/package.json`, rebuild and upload the new `.exe`. Computers that already have the app offer the update themselves (see [Desktop app behaviour](#desktop-app-behaviour)); installing over the old version keeps settings.
- **Signing:** set `CSC_LINK` / `CSC_KEY_PASSWORD` to code-sign.

**Startup:**
- With `--autostart` (set by Windows sign-in), the app waits 6 s and shows the briefing once per day. Opening it manually always shows it.
- **Network:** 6 attempts over about a minute (waits of 0, 2, 5, 10, 20 and 30 s; 15 s per request).
- **Offline:** if every attempt fails, it shows the last cached briefing with an "Offline" note, or a "can't reach the server" message.
- A rejected token shows "pair again" immediately.

## Briefing API contract

`GET /api/companion/briefing`
- Header: `Authorization: Bearer pcd_…`.
- Optional query: `?fresh=1` skips the cache.
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

- **Mood:** `worried` if any section is red, `neutral` if any is amber, otherwise `happy`.
- **Sections:** a section appears only when something is configured; **Today** always appears.
- **Shared types:** the panel's `lib/services/companion/types.ts` and the app's `companion/src/shared/briefing.ts` must stay in sync. The app re-validates the response.

## Files

| Area | Files |
|---|---|
| Page | `app/(app)/companion/` |
| UI | `components/companion/*`: `setup-guide.tsx` is the in-page guide |
| Actions / validation | `lib/actions/companion.ts`, `lib/validations/companion.ts` |
| Services | `lib/services/companion/`: `settings.ts`, `devices.ts`, `accounts.ts`, `installer.ts`, `reminder.ts`, `task-actions.ts`, `versions.ts`, `briefing.ts`, `net.ts`, `time.ts`, `email-scoring.ts`, `google.ts`, `oauth-state.ts` |
| Integrations | `lib/services/companion/integrations/`: `websites.ts`, `slack.ts`, `gmail.ts`, `tasks.ts` |
| API | `app/api/companion/briefing`, `app/api/companion/reminder`, `app/api/companion/update`, `app/api/companion/task`, `app/api/companion/installer`, `app/api/companion/google/{connect,callback}` |
| Shared | `lib/crypto.ts`, `lib/services/storage.ts`, `listOpenTasksDueBefore()` in `lib/services/tasks.ts` |
| Desktop app | `companion/` (see `companion/README.md`) |

## Testing

- **Offline checks:** `npx tsx scripts/test-companion.ts` needs no database or network. It covers (among the others below) version comparison, installer file names, task due instants, work-hour checks, reminder tick timing and update-payload validation. Full list:
  - email scoring;
  - time-zone days;
  - private-address blocking;
  - Slack matching;
  - encryption;
  - website classification against a local server.
- **Desktop app:** `cd companion && npm run sample`.
- **End to end:** pair a device on `/companion`, then run:

  ```bash
  curl -H "Authorization: Bearer <token>" http://localhost:3000/api/companion/briefing
  ```

## Known limitations

- **No reply drafting and no AI.**
- **The 60-second cache is per server instance.**
- **Website checks don't pin DNS** between the address check and the request (DNS rebinding isn't caught).
- **Unsigned installer:** SmartScreen warns on first install.
