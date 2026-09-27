# Projects and Time Tracking

The Projects module: client projects with live, per-user time tracking.

Related: [AUTHORIZATION.md](./AUTHORIZATION.md) · [DATABASE.md](./DATABASE.md) · [MODULES.md](./MODULES.md)

---

## Files

| Layer | Files |
|---|---|
| Pages | `app/(app)/projects/page.tsx` (list), `new/page.tsx`, `[id]/page.tsx` (detail), `[id]/edit/page.tsx`, `layout.tsx` (gate: `projects:view`) |
| Components | `components/projects/project-list.tsx`, `project-stats-cards.tsx`, `project-details.tsx`, `project-timer-card.tsx`, `project-time-entries-table.tsx`, `project-form.tsx`, `delete-project-item.tsx` |
| Server Actions | `lib/actions/projects.ts` |
| Service | `lib/services/projects.ts` |
| Validation | `lib/validations/project.ts` |
| API | `app/api/projects/**` (see [API](#api)) |
| Formatting | `lib/time-format.ts` (`formatDuration`, `formatTimerClock`) |
| Check script | `scripts/test-project-timer.ts` |

## Data model

### `Project`

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required, max 200 characters |
| `description` | string? | Required by the form's validation |
| `status` | `ProjectStatus` | `NOT_STARTED` (default), `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` |
| `priority` | `ProjectPriority` | `LOW`, `MEDIUM` (default), `HIGH`, `URGENT` |
| `customerId` | → `Customer`? | Optional; picker lists active customers |
| `assignedToId` | → `User`? | Optional; picker lists active users |
| `startDate`, `dueDate` | date? | Optional |
| `notes` | string? | |
| `createdById` | → `User`? | Set to the user who created it |

### `ProjectTimeEntry`

One row per timer session.

| Field | Notes |
|---|---|
| `projectId` | Cascade-deleted with the project |
| `userId` | The user who started the session (the owner) |
| `startedAt`, `endedAt` | `endedAt` is set on pause and stop |
| `durationSeconds` | Written when the session is paused or stopped; `0` while running |
| `status` | `RUNNING`, `PAUSED` or `COMPLETED` |
| `notes` | Optional note given when starting |

## Project lifecycle

Status is set in the project form, with two automatic changes:

| Trigger | Change |
|---|---|
| Timer **started** on a `NOT_STARTED` project | → `IN_PROGRESS` |
| Timer **resumed** on a `NOT_STARTED` or `ON_HOLD` project | → `IN_PROGRESS` |
| Project edited to `COMPLETED` | All `RUNNING` entries are completed (duration up to now) and all `PAUSED` entries are marked `COMPLETED`, whoever owns them; logged as `PROJECT_COMPLETED` |

A `COMPLETED` project can't start or resume a timer ("Please reopen the project first"). `CANCELLED` and `ON_HOLD` projects are not blocked from starting one.

## Time tracking

### Operations

All four run in a database transaction in `lib/services/projects.ts` and are called from Server Actions in `lib/actions/projects.ts` (`projects:timer`).

| Operation | Preconditions | Effect |
|---|---|---|
| **Start** | Project exists and isn't `COMPLETED`; the project has no `RUNNING` entry; the caller has no `RUNNING` entry on any project | New `RUNNING` entry for the caller |
| **Pause** | The project has a `RUNNING` entry **owned by the caller** | That entry → `PAUSED`, `endedAt` = now, `durationSeconds` = elapsed |
| **Resume** | Same as Start | New `RUNNING` entry for the caller. Resuming never reopens the paused entry. |
| **Stop** | If the project has a `RUNNING` entry, it must be **owned by the caller** | That entry → `COMPLETED` with its duration; every `PAUSED` entry on the project → `COMPLETED` |

Error messages the UI shows:

- "This project already has an active timer."
- `You already have an active timer running on project "<name>". Please pause or stop it first.`
- "You can only control your own timer."
- "No active running timer found for this project." (pause with nothing running)

### Timer ownership

- Only the user who started a running session can pause or stop it. This applies to both roles; there is no admin override.
- Start and resume always create a session owned by the caller.
- Not owner-restricted: resuming a project whose last session was paused by someone else (it creates a new session for the caller), stop's clean-up of `PAUSED` entries, and completing the project through the edit form.

### One running timer at a time

- Per project: at most one `RUNNING` entry.
- Per user: at most one `RUNNING` entry across all projects.
- These are checked inside the transaction, not by a database constraint.

### Duration calculation

`computeProjectTimerMetrics()` derives everything from the time entries, using server time:

- **Total duration** = sum of `durationSeconds` for non-running entries + (now − `startedAt`) for the running entry.
- **`timerStatus`**: `COMPLETED` if the project is completed; `RUNNING` if an entry is running; `PAUSED` if the most recent entry is paused; otherwise `IDLE`.
- **`activeTimer`**: the running entry's id, start time, elapsed seconds and owner.

The timer card (`project-timer-card.tsx`) and the list rows (`project-list.tsx`) tick every second in the browser, starting from the server's `startedAt`. After each action they call `router.refresh()` to reload server data.

There is no UI or API to edit or delete individual time entries.

## Activity trail

Every project and timer operation writes an `ActivityLog` row with `entityType: "project"` and `projectId`. This is best-effort; a failure is ignored.

| `type` | When |
|---|---|
| `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_COMPLETED`, `PROJECT_DELETED` | Project create / edit / edit to completed / delete |
| `TIMER_STARTED`, `TIMER_PAUSED`, `TIMER_RESUMED`, `TIMER_STOPPED` | Timer operations; the pause message includes the session length |

The project detail page shows the 10 most recent entries. Rows survive project deletion, with `projectId` set to null.

## Permissions

| Permission | Allows | Employee |
|---|---|:-:|
| `projects:view` | Open `/projects/**`; GET API routes | ✓ |
| `projects:create` | Create a project | ✓ |
| `projects:edit` | Edit a project, including setting it to `COMPLETED` | ✓ |
| `projects:delete` | Delete a project and all its time entries | — |
| `projects:timer` | Start, pause, resume, stop | ✓ |

The Delete button is visible to everyone on the detail page; the action rejects users without `projects:delete`.

## List page — search, filters, sorting

`/projects` reads these URL parameters:

| Parameter | Values | Notes |
|---|---|---|
| `q` | text | Case-insensitive match on project name, description, customer name or assignee name |
| `status` | `ProjectStatus` | |
| `priority` | `ProjectPriority` | |
| `hasActiveTimer` | `true` | Only projects with a `RUNNING` entry |
| `sort` | `createdAt` (default), `dueDate`, `name`, `totalTime`, `priority` | Unknown values fall back to `createdAt` |
| `order` | `asc`, `desc` (default) | No UI control; URL only |
| `page` | number | 15 per page |

The service and API also accept `assignedToId` and `customerId`; the page doesn't expose them.

**Sorting by total time** ranks projects using database aggregates: one `groupBy` summing `durationSeconds` per project, plus the live elapsed time of running entries. It then loads full records only for the requested page, so it doesn't pull every time entry.

## Statistics

`getProjectStats()` feeds the cards at the top of the list:

- total projects;
- projects in progress, completed, not started and on hold;
- total tracked time (database sum of non-running entries + live elapsed time of running entries);
- number of active timers.

## API

JSON routes for programmatic use. The app's own UI uses Server Actions instead. Permissions and status codes: [AUTHORIZATION.md — API protection](./AUTHORIZATION.md#api-protection).

| Route | Methods |
|---|---|
| `/api/projects` | GET (list, same parameters as the page plus `assignedToId`, `customerId`, `pageSize`), POST (create) |
| `/api/projects/[id]` | GET, PUT, DELETE |
| `/api/projects/[id]/timer/start` | POST, optional JSON body `{ "notes": "..." }` |
| `/api/projects/[id]/timer/pause`, `resume`, `stop` | POST |
| `/api/projects/[id]/timer/status` | GET — status, active timer, total seconds, `serverTime` |
| `/api/projects/[id]/time-entries` | GET — entries with user, newest first |

`next.config.ts` rewrites `/projects/:id/timer/:action` and `/projects/:id/time-entries` to these routes.

## Limitations

- The one-running-timer rules are checked in code, not enforced by a database constraint.
- Completing a project through the edit form closes other users' running sessions.
- Time entries can't be edited or deleted individually.
- Deleting a project permanently deletes its time history.
