import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Clock, Download, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { listProjects } from "@/lib/services/projects";
import { getTimesheet, listTimesheetPeople } from "@/lib/services/timesheets";
import { GROUPS, PRESETS, PRESET_LABELS, formatHoursMinutes, type GroupBy } from "@/lib/timesheet";
import { parseTimesheetQuery } from "@/lib/validations/timesheet";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Timesheet" };
export const dynamic = "force-dynamic";

const GROUP_LABELS: Record<GroupBy, string> = { task: "Task", project: "Project", person: "Person", day: "Day" };
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
  const [sheet, people, projectsData] = await Promise.all([
    getTimesheet(user, query),
    listTimesheetPeople(user),
    listProjects({ pageSize: 100 }, user),
  ]);
  const projects = projectsData.projects.map((p) => ({ id: p.id, name: p.name }));
  const isAdmin = user.role === "ADMIN";

  // Keeps the other filters when switching preset or grouping.
  const href = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      preset: query.preset,
      from: query.preset === "custom" ? sheet.range.fromKey : undefined,
      to: query.preset === "custom" ? sheet.range.toKey : undefined,
      group: query.group,
      user: isAdmin ? query.user : undefined,
      project: query.project,
      task: query.task,
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

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter((p) => p !== "custom").map((preset) => (
          <Button key={preset} asChild size="sm" variant={query.preset === preset ? "default" : "outline"} className="h-8 text-xs">
            <Link href={href({ preset, from: undefined, to: undefined })}>{PRESET_LABELS[preset]}</Link>
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
            Apply custom range
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground">
        {sheet.range.fromKey === sheet.range.toKey ? sheet.range.fromKey : `${sheet.range.fromKey} to ${sheet.range.toKey}`} ({sheet.range.days}{" "}
        {sheet.range.days === 1 ? "day" : "days"}). Stopped timers count in full; a running timer counts up to now.
        {sheet.truncated && " Showing the first 5,000 entries; narrow the range for exact totals."}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total time" value={`${formatHoursMinutes(sheet.totalSeconds)} h`} icon={Clock} />
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
                  {!sheet.scopedToSelf && <TableHead>Person</TableHead>}
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheet.list.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(e.startedAt)}</TableCell>
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
                      {e.running && <span className="ml-1 text-[10px] text-emerald-600">running</span>}
                    </TableCell>
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
