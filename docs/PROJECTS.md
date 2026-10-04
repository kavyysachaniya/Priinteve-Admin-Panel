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

One row per timer session.

| Field | Notes |
|---|---|
| `projectId` | Cascade-deleted with the project |
| `userId` | The user who started the session (the owner) |
| `taskId` | Optional foreign key to `Task` (SetNull on delete) |
| `taskDescription` | Required description of work performed (minimum 3 characters) |
| `startedAt`, `endedAt` | `endedAt` is set on pause and stop |
| `durationSeconds` | Written when the session is paused or stopped; `0` while running |
| `status` | `RUNNING`, `PAUSED` or `COMPLETED` |
| `notes` | Optional note given when starting |
| `flaggedForReview` | Set to true if a timer ran longer than 12 hours |
| `approvedAt`, `approvedById` | Set when an admin approves the entry. Clients see only approved entries. Cleared when the entry is edited |

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

Timer operations run in a database transaction in `lib/services/projects.ts`:

| Operation | Preconditions | Effect |
|---|---|---|
| **Start** | Project visible to caller; project isn't `COMPLETED`; caller is Admin or assigned employee; `taskDescription` provided (>= 3 chars) | New `RUNNING` entry for the caller. If caller already had a running timer, it is automatically stopped and completed first. |
| **Pause** | The project has a `RUNNING` entry **owned by the caller** | That entry → `PAUSED`, `endedAt` = now, `durationSeconds` = elapsed |
| **Resume** | Same as Start | New `RUNNING` entry for the caller. Resuming never reopens the paused entry. |
| **Stop** | Caller owns the running entry, or caller is stopping active timer via `/api/timer/stop` | Entry → `COMPLETED` with calculated duration. If duration exceeds 12 hours, `flaggedForReview` is set. |

### Time Entry Editing & Deletion
- **Admin**: Can edit description/times or delete any time entry.
- **Employee**: Can edit or delete their own time entries within a 24-hour window from start. Overlapping time entries are rejected.
- Editing an entry clears its approval, so changed time must be approved again.

### Starting a timer from a task
- A task card on the board (`/tasks` or the project's Tasks tab) has a Start button for admins and assigned employees. It posts `taskId` and the task title as the description to `/api/projects/[id]/timer/start`, so the entry is linked to the task. The card shows who is working and the live elapsed time; the owner can stop it from the card. Clients see only "<name> is working".

### Time approval
- Only admins (`projects:approve_time`) can approve. A completed entry (`endedAt` set) is approved or unapproved one at a time, or in bulk with "Approve all pending" on the Timer tab. Running entries can't be approved.
- **Clients see approved time only.** `listProjectTimeEntries`, `getProjectById`, `listProjects` and `toClientProjectDto` drop unapproved entries for clients, and client totals and time-per-task count approved entries only. A running timer still shows as "someone is working now" but adds nothing to client totals.
- Staff see an Approved / Pending badge on every entry.

### Persistent Header Chip
- Active timers are polled via `/api/timer/active` and shown in a topbar header chip with live elapsed time and a quick Stop button.

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
| `/api/projects/[id]/time-entries` | GET | All (scoped, redacted for CLIENT) | List project entries |
| `/api/timer/active` | GET | ADMIN, EMPLOYEE | Caller's active running timer |
| `/api/timer/stop` | POST | ADMIN, EMPLOYEE | Stop caller's active running timer |
| `/api/time-entries/[id]` | PATCH, DELETE | ADMIN, owner within 24h | Update or delete time entry |
| `/api/time-entries/[id]/approve` | POST, DELETE | ADMIN | Approve / unapprove a time entry |
| `/api/projects/[id]/time-entries/approve` | POST | ADMIN | Approve all completed, unapproved entries |
| `/api/projects/[id]/assignable-users` | GET | All (scoped) | Admins, assigned employees and the project's client users who can be assigned tasks |

## One active timer per user (database index)

A partial unique index `ProjectTimeEntry_one_active_per_user` (`userId` where `endedAt IS NULL`) enforces one active timer per employee at the database level. Prisma cannot express it, so it lives in `prisma/sql/active-timer-index.sql`. Re-apply that file after `npm run db:push` if the index is dropped.
