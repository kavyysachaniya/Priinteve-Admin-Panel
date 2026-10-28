import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Download, ListChecks, Timer, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EntryHistoryButton } from "@/components/timesheet/entry-history-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { listProjects } from "@/lib/services/projects";
import { getTimeOverview, getTimesheet, listTimeAttention, listTimesheetPeople } from "@/lib/services/timesheets";
import {
  ENTRY_FILTERS,
  GROUPS,
  PRESETS,
  PRESET_LABELS,
  TIMESHEET_TZ,
  currentMonthKey,
  formatHoursMinutes,
  type EntryFilter,
  type GroupBy,
} from "@/lib/timesheet";
import { parseTimesheetQuery } from "@/lib/validations/timesheet";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Timesheet" };
export const dynamic = "force-dynamic";

const GROUP_LABELS: Record<GroupBy, string> = { task: "Task", project: "Project", person: "Person", day: "Day" };
const FILTER_LABELS: Record<EntryFilter, string> = {
  all: "All entries",
  running: "Running",
  completed: "Stopped",
  attention: "Needs review",
};
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function TimesheetPage({ searchParams }: PageProps<"/timesheet">) {
  let user;
  try {
    user = await requirePermission("timesheet:view");
  } catch {
    redirect("/dashboard");
  }

  const query = parseTimesheetQuery(await searchParams);
  const [sheet, people, projectsData, overview, attention] = await Promise.all([
    getTimesheet(user, query),
    listTimesheetPeople(user),
    listProjects({ pageSize: 100 }, user),
    getTimeOverview(user, query.user),
    listTimeAttention(user, query.user),
  ]);
  const projects = projectsData.projects.map((p) => ({ id: p.id, name: p.name }));
  const isAdmin = user.role === "ADMIN";
  const thisMonth = currentMonthKey();

  // Keeps the other filters when switching preset or grouping.
  const href = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      preset: query.preset,
      from: query.preset === "custom" && !query.month ? sheet.range.fromKey : undefined,
      to: query.preset === "custom" && !query.month ? sheet.range.toKey : undefined,
      month: query.month,
      group: query.group,
      user: isAdmin ? query.user : undefined,
      project: query.project,
      task: query.task,
      status: query.status === "all" ? undefined : query.status,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    return `/timesheet?${params.toString()}`;
  };
  const exportHref = `/api/timesheet/export?${href({}).split("?")[1]}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timesheet"
        description={
          sheet.scopedToSelf
            ? "Your tracked time by task, project and day."
            : "Tracked time by task, project, person and day. Pick a person to see one timesheet."
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
        }
        className="mb-0"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Today" value={`${formatHoursMinutes(overview.todaySeconds)} h`} icon={Timer} />
        <StatCard label="This week" value={`${formatHoursMinutes(overview.weekSeconds)} h`} icon={CalendarDays} />
        <StatCard label="This month" value={`${formatHoursMinutes(overview.monthSeconds)} h`} icon={Clock} />
        <StatCard
          label="Average per worked day"
          value={`${formatHoursMinutes(overview.averagePerDaySeconds)} h`}
          changeLabel={`${overview.monthDaysWorked} ${overview.monthDaysWorked === 1 ? "day" : "days"} worked this month`}
          changeDirection="neutral"
          icon={TrendingUp}
        />
        <StatCard label="Tasks completed this month" value={String(overview.completedTasks)} icon={CheckCircle2} />
      </div>

      {overview.running.length > 0 && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">Running now: </span>
          {overview.running
            .map(
              (r) =>
                `${sheet.scopedToSelf ? "" : `${r.userName} · `}${r.projectName}${r.taskTitle ? ` · ${r.taskTitle}` : ""} (since ${formatDateTime(r.startedAt)})`
            )
            .join("; ")}
        </div>
      )}

      {attention.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
            <AlertTriangle className="size-4 text-amber-600" /> Needs attention
            <span className="text-xs font-normal text-muted-foreground">
              Interrupted, very long, corrected or unconfirmed sessions from the last 60 days
            </span>
          </div>
          <ul className="divide-y text-sm">
            {attention.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(a.startedAt)}</span>
                {!sheet.scopedToSelf && <span>{a.userName}</span>}
                <Link href={`/projects/${a.projectId}?tab=timer`} className="font-medium text-primary hover:underline">
                  {a.projectName}
                </Link>
                {a.taskTitle && <span className="text-muted-foreground">{a.taskTitle}</span>}
                <span className="font-mono text-xs tabular-nums">{formatHoursMinutes(a.seconds)} h</span>
                <span className="text-xs text-amber-700 dark:text-amber-400">{a.reasons.join(" · ")}</span>
                <EntryHistoryButton entryId={a.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <form method="get" action="/api/timesheet/export" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <label className="space-y-1 text-xs font-medium">
          Monthly export
          <input type="month" name="month" defaultValue={query.month ?? thisMonth} className={selectClass} required />
        </label>
        {isAdmin && query.user && <input type="hidden" name="user" value={query.user} />}
        {query.project && <input type="hidden" name="project" value={query.project} />}
        <Button type="submit" size="sm" variant="outline" className="h-9">
          <Download className="size-4" /> Detailed CSV
        </Button>
        <Button type="submit" size="sm" variant="outline" className="h-9" name="summary" value="1">
          <Download className="size-4" /> Summary CSV
        </Button>
        <Button asChild size="sm" variant="ghost" className="h-9">
          <Link href={href({ month: query.month ?? thisMonth, preset: "custom", from: undefined, to: undefined })}>View month</Link>
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Times are in {TIMESHEET_TZ}. Sessions crossing the month edge keep their real start and end; only the part inside the month counts toward
          its total. Paused time is never counted.
        </p>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter((p) => p !== "custom").map((preset) => (
          <Button
            key={preset}
            asChild
            size="sm"
            variant={!query.month && query.preset === preset ? "default" : "outline"}
            className="h-8 text-xs"
          >
            <Link href={href({ preset, from: undefined, to: undefined, month: undefined })}>{PRESET_LABELS[preset]}</Link>
          </Button>
        ))}
      </div>

      <form method="get" className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
        <input type="hidden" name="preset" value="custom" />
        <input type="hidden" name="group" value={query.group} />
        <label className="space-y-1 text-xs font-medium">
          From
          <input type="date" name="from" defaultValue={sheet.range.fromKey} className={selectClass} />
        </label>
        <label className="space-y-1 text-xs font-medium">
          To
          <input type="date" name="to" defaultValue={sheet.range.toKey} className={selectClass} />
        </label>
        <label className="space-y-1 text-xs font-medium">
          Project
          <select name="project" defaultValue={query.project ?? ""} className={selectClass}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          Entries
          <select name="status" defaultValue={query.status} className={selectClass}>
            {ENTRY_FILTERS.map((f) => (
              <option key={f} value={f}>
                {FILTER_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        {isAdmin && (
          <label className="space-y-1 text-xs font-medium">
            Person
            <select name="user" defaultValue={query.user ?? ""} className={selectClass}>
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-end">
          <Button type="submit" size="sm" className="h-9 w-full">
            Apply
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground">
        {sheet.range.fromKey === sheet.range.toKey ? sheet.range.fromKey : `${sheet.range.fromKey} to ${sheet.range.toKey}`} ({sheet.range.days}{" "}
        {sheet.range.days === 1 ? "day" : "days"}). Only time inside this range counts: a session crossing midnight or the range edge is split, and
        a running timer counts up to now.
        {sheet.truncated && " Showing the first 5,000 entries; narrow the range for exact totals (the CSV export includes more)."}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total in range" value={`${formatHoursMinutes(sheet.totalSeconds)} h`} icon={Clock} />
        <StatCard label="Entries" value={String(sheet.entries.length)} icon={ListChecks} />
        <StatCard label="Days worked" value={String(sheet.daysWorked)} icon={CalendarDays} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Group by</span>
        {GROUPS.map((g) => (
          <Button key={g} asChild size="sm" variant={query.group === g ? "default" : "outline"} className="h-8 text-xs">
            <Link href={href({ group: g })}>{GROUP_LABELS[g]}</Link>
          </Button>
        ))}
      </div>

      {sheet.entries.length === 0 ? (
        <EmptyState icon={Clock} title="No time tracked" description="Nothing was tracked in this period with these filters." />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{GROUP_LABELS[query.group]}</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="w-40">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheet.groups.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell className="font-medium">{g.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.entries}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatHoursMinutes(g.seconds)}</TableCell>
                    <TableCell>
                      <div className="h-1.5 w-full rounded-full bg-muted" aria-label={`${Math.round(g.share * 100)}%`}>
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round(g.share * 100)}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3 text-sm font-semibold">Entries</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  {!sheet.scopedToSelf && <TableHead>Person</TableHead>}
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheet.list.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(e.startedAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {e.endedAt ? formatDateTime(e.endedAt) : "—"}
                    </TableCell>
                    {!sheet.scopedToSelf && <TableCell>{e.userName}</TableCell>}
                    <TableCell>{e.projectName}</TableCell>
                    <TableCell>
                      {e.taskId ? (
                        <Link href={`/tasks/${e.taskId}`} className="text-primary hover:underline">
                          {e.taskTitle}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{e.description ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatHoursMinutes(e.seconds)}
                      {e.seconds !== e.recordedSeconds && (
                        <span className="ml-1 text-[10px] text-muted-foreground" title="Part of a session that crosses the range edge">
                          of {formatHoursMinutes(e.recordedSeconds)}
                        </span>
                      )}
                      {e.running && <span className="ml-1 text-[10px] text-emerald-600">running</span>}
                      {e.status === "PAUSED" && <span className="ml-1 text-[10px] text-amber-600">paused</span>}
                      <div className="mt-0.5 flex justify-end gap-1">
                        {e.interrupted && <Badge variant="outline" className="h-4 px-1 text-[10px]">interrupted</Badge>}
                        {e.corrected && <Badge variant="outline" className="h-4 px-1 text-[10px]">corrected</Badge>}
                        {e.flagged && <Badge variant="outline" className="h-4 px-1 text-[10px]">over 12 h</Badge>}
                        {e.source === "DESKTOP_OFFLINE" && <Badge variant="outline" className="h-4 px-1 text-[10px]">synced late</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{e.corrected || e.interrupted ? <EntryHistoryButton entryId={e.id} /> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sheet.entries.length > sheet.list.length && (
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                Showing the latest {sheet.list.length} of {sheet.entries.length} entries. Export the CSV for all of them.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
