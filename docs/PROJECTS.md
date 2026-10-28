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
| `assignedToId` | → `User`? | Optional primary assignee |
| `startDate`, `dueDate` | date? | Optional |
| `notes` | string? | Internal notes (hidden from `CLIENT` users) |
| `createdById` | → `User`? | Set to the user who created it |
| `assignments` | → `ProjectAssignment[]` | Multi-employee team assignments |
| `tasks` | → `Task[]` | Tasks belonging to this project |

### `ProjectAssignment`

Links employees to projects for scoping and task assignments.

| Field | Type | Notes |
|---|---|---|
| `projectId` | → `Project` | Cascade-deleted with project |
| `employeeId` | → `User` | Assigned employee |
| `assignedById` | → `User` | User who assigned |
| `assignedAt` | DateTime | Timestamp of assignment |

- Unique on `(projectId, employeeId)`.
- When an employee is unassigned from a project while they have a running timer on it, the timer is automatically stopped.

### `ProjectTimeEntry`

One row per **segment**: one uninterrupted stretch of running time. A **work session** is start → (pause → resume)* → stop. Each resume opens a new segment, and all segments of one session share `sessionId`. Paused time is the gap between segments, so it is never counted.

| Field | Notes |
|---|---|
| `projectId` | Cascade-deleted with the project |
| `userId` | The user who started the session (the owner) |
| `taskId` | Optional foreign key to `Task` (SetNull on delete). Must belong to the same project |
| `taskDescription` | Required description of work performed (minimum 3 characters) |
| `startedAt`, `endedAt` | `endedAt` is set on pause and stop |
| `durationSeconds` | Worked seconds of the segment, from the timestamps. Written on pause and stop; `0` while running |
| `status` | `RUNNING`; `PAUSED` (the session's latest segment, waiting for resume); `COMPLETED` |
| `sessionId` | The session's first segment id. Rows from before sessions existed were backfilled to their own id (`scripts/backfill-time-sessions.ts`) |
| `clientOpId` | Unique idempotency key of the client action that created the segment (desktop op id) |
| `lastHeartbeatAt` | Last time the desktop app confirmed it was alive while this ran (null for web-only timers) |
| `source` | `WEB`, `DESKTOP` or `DESKTOP_OFFLINE` (an action queued offline and synced later) |
| `stopReason` | `USER`, `SWITCH`, `SHUTDOWN`, `RECOVERY`, `AUTO_UNASSIGN` or `PROJECT_COMPLETED` |
| `interrupted` | Closed through the desktop app's interrupted-session recovery |
| `notes` | Optional note given when starting |
| `flaggedForReview` | Set to true if a segment ran longer than 12 hours |
| `approvedAt`, `approvedById` | Set when an admin approves the entry. Clients see only approved entries. Cleared when the entry is edited |

### `TimeEntryCorrection`

Audit trail for manual changes: `action` (`EDIT`, `DELETE`, `RECOVERY`), a required `reason`, `before`/`after` JSON snapshots, `changedById` and `createdAt`. Corrections are written in the same transaction as the change. After a delete, `entryId` becomes null but `before` keeps the values.

### `TimerOperation`

Ledger of desktop timer actions (`opId` unique, `type`, `occurredAt`, `status` `APPLIED`/`CONFLICT`/`REJECTED`, `result`). Replaying an `opId` returns the stored result instead of acting again. See [COMPANION.md](./COMPANION.md#desktop-time-tracker).

## Project lifecycle & access scoping

Status is set in the project form, with two automatic changes:

| Trigger | Change |
|---|---|
| Timer **started** on a `NOT_STARTED` project | → `IN_PROGRESS` |
| Timer **resumed** on a `NOT_STARTED` or `ON_HOLD` project | → `IN_PROGRESS` |
| Project edited to `COMPLETED` | All `RUNNING` entries are completed (duration up to now) and all `PAUSED` entries are marked `COMPLETED`, whoever owns them; logged as `PROJECT_COMPLETED` |

### Role-based visibility
- **`ADMIN`**: Sees all projects, can assign employees, edit, delete, and manage all timers.
- **`EMPLOYEE`**: Sees only projects assigned to them via `ProjectAssignment` (or legacy `assignedToId`). Can start timers and create/update tasks on assigned projects.
- **`CLIENT`**: Sees only projects where `project.customerId === user.customerId`. Accessing another customer's project returns 404 (does not leak existence). Client responses use a redacted DTO that hides internal notes, financial figures, hourly rates, costs, and audit logs.

## Time tracking

### Operations

Timer operations in `lib/services/projects.ts` run in a **Serializable** transaction, with one retry on a serialization conflict (`P2034`). The partial unique index below is the backstop. A unique violation from it becomes "You already have a timer running." Durations always come from stored timestamps.

| Operation | Preconditions | Effect |
|---|---|---|
| **Start** | Project isn't `COMPLETED`; caller is Admin or assigned employee; the task (if any) belongs to the project and isn't completed or cancelled | New `RUNNING` segment and session. With `autoStopPrevious` (every UI path), the caller's running segment is completed first (`stopReason` `SWITCH`) and their paused session is closed. A `TODO` task moves to `IN_PROGRESS`. Another user's running timer on the same project blocks the start. |
| **Pause** | The project has a `RUNNING` entry **owned by the caller** | That segment → `PAUSED`, `endedAt` = the pause time. Pausing again returns the paused segment (no-op). |
| **Resume** | Caller is assigned (Admin always) and has their **own** `PAUSED` segment on the project | That segment → `COMPLETED`. A new `RUNNING` segment opens with the same `sessionId`, task and description. Resuming while already running on the project is a no-op. |
| **Stop** | Caller owns the running segment (Admins may stop anyone's) | Running segment → `COMPLETED` with `stopReason`. Only the **owner's** paused segments on the project are completed, never other users'. Stopping with nothing open succeeds as a no-op. |

Every operation accepts `TimerOpOptions`:
- `at`: a past time for an action queued offline. It is clamped so it is never in the future and never before the segment it closes.
- `source`.
- `clientOpId`: idempotency key.
- `stopReason`.

### Time Entry Editing & Deletion (corrections)
- **Admin**: Can edit description/times or delete any time entry.
- **Employee**: Can edit or delete their own time entries within 24 hours of the entry's creation. Overlapping entries are rejected; a running segment counts up to now for the overlap check.
- **A reason is required.** Every edit and delete writes a `TimeEntryCorrection` with the values before (and after) and an activity log line. History is never overwritten silently.
- An end time can't be removed. Giving a running segment an end time completes it.
- The duration is recomputed only when the times change, so a description fix never alters recorded time.
- A running segment can't be deleted; stop it first.
- Editing an entry clears its approval, so changed time must be approved again.
- The history is shown from the timesheet (`/api/time-entries/[id]/corrections`).

### Starting a timer from a task
- A task card on the board (`/tasks` or the project's Tasks tab) has a Start button for admins and assigned employees. It posts `taskId` and the task title as the description to `/api/projects/[id]/timer/start`, so the entry is linked to the task. The card shows who is working and the live elapsed time; the owner can stop it from the card. Clients see only "<name> is working".

### Time approval
- Only admins (`projects:approve_time`) can approve. A completed entry (`endedAt` set) is approved or unapproved one at a time, or in bulk with "Approve all pending" on the Timer tab. Running entries can't be approved.
- **Clients see approved time only.** `listProjectTimeEntries`, `getProjectById`, `listProjects` and `toClientProjectDto` drop unapproved entries for clients, and client totals and time-per-task count approved entries only. A running timer still shows as "someone is working now" but adds nothing to client totals.
- Staff see an Approved / Pending badge on every entry.

### Persistent Header Chip
- Active timers are polled via `/api/timer/active` and shown in a topbar header chip with live elapsed time and a quick Stop button.
- Every timer control fires the `timer-changed` browser event (`lib/timer-events.ts`), so the chip refreshes at once instead of waiting for its 15 s poll.
- The chip corrects for a wrong PC clock using the `serverTime` returned with the active timer.

## Permissions

| Permission | Allows | Employee | Client |
|---|---|:-:|:-:|
| `projects:view` | Open `/projects/**`; GET API routes | ✓ (assigned) | ✓ (own) |
| `projects:create` | Create a project | ✓ | — |
| `projects:edit` | Edit a project, including setting it to `COMPLETED` | ✓ | — |
| `projects:delete` | Delete a project and all its time entries | — | — |
| `projects:timer` | Start, pause, resume, stop | ✓ (assigned) | — |
| `projects:approve_time` | Approve or unapprove time entries | — | — |

## API

JSON routes for programmatic use and client components:

| Route | Methods | Roles | Purpose |
|---|---|---|---|
| `/api/projects` | GET, POST | All (scoped) | List / create projects |
| `/api/projects/[id]` | GET, PUT, DELETE | All (scoped) | Details / update / delete |
| `/api/projects/[id]/assignments` | GET, POST | GET: scoped, POST: ADMIN | List / assign employees |
| `/api/projects/[id]/assignments/[employeeId]` | DELETE | ADMIN | Unassign employee |
| `/api/projects/[id]/tasks` | GET, POST | All (scoped) | List / create project tasks |
| `/api/projects/[id]/timer/start` | POST | ADMIN, EMPLOYEE (assigned) | Start timer (`taskDescription`, optional `taskId`) |
| `/api/projects/[id]/timer/pause`, `resume`, `stop` | POST | ADMIN, owner | Pause / resume / stop |
| `/api/projects/[id]/timer/status` | GET | All with access to the project | Timer status; redacted for clients (no name or task) |
| `/api/time-entries/[id]/corrections` | GET | ADMIN, owner | Correction history of an entry |
| `/api/companion/timer`, `/api/companion/timer/ops` | GET, POST | Device token (`projects:timer`) | Desktop time tracker; see [COMPANION.md](./COMPANION.md#desktop-time-tracker) |
| `/api/projects/[id]/time-entries` | GET | All (scoped, redacted for CLIENT) | List project entries |
| `/api/timer/active` | GET | ADMIN, EMPLOYEE | Caller's active running timer |
| `/api/timer/stop` | POST | ADMIN, EMPLOYEE | Stop caller's active running timer |
| `/api/time-entries/[id]` | PATCH, DELETE | ADMIN, owner within 24h | Update or delete time entry |
| `/api/time-entries/[id]/approve` | POST, DELETE | ADMIN | Approve / unapprove a time entry |
| `/api/projects/[id]/time-entries/approve` | POST | ADMIN | Approve all completed, unapproved entries |
| `/api/projects/[id]/assignable-users` | GET | All (scoped) | Admins, assigned employees and the project's client users who can be assigned tasks |

## One active timer per user (database index)

A partial unique index `ProjectTimeEntry_one_active_per_user` (`userId` where `endedAt IS NULL`) enforces one running segment per user at the database level. Prisma cannot express it, so it lives in `prisma/sql/active-timer-index.sql`. `npm run db:push` re-applies it automatically (`npm run db:index`). `scripts/backfill-time-sessions.ts` reports whether it is present.

## Time visibility and approval

- **Staff** (admins and employees) see a stopped timer's time immediately, on the project's Timer tab, on the task page, and in the [timesheet](./MODULES.md#timesheet). No approval is needed for it to count.
- **Approval now only controls what clients see.** The admin buttons are worded **Share with client** / **Hide from client** (and **Share all with client**), and entries show **Shared with client** or **Not shared**. They call the same approve/unapprove endpoints, and editing an entry still resets it to not shared.
- **Clients** still see only shared entries (and a running timer as "someone is working"), unchanged.
