"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Play,
  Square,
  Clock,
  AlertTriangle,
  Loader2,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  CheckCheck,
  Undo2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration, formatTimerClock, formatDate, formatTime } from "@/lib/time-format";
import type { TimeEntryStatus } from "@prisma/client";

interface TimeEntryData {
  id: string;
  startedAt: Date | string;
  endedAt: Date | string | null;
  durationSeconds: number;
  status: TimeEntryStatus;
  notes?: string | null;
  taskDescription?: string | null;
  taskId?: string | null;
  flaggedForReview?: boolean;
  approvedAt?: Date | string | null;
  createdAt?: Date | string;
  user?: {
    id?: string;
    name: string;
    email?: string | null;
  } | null;
  task?: {
    id: string;
    title: string;
  } | null;
}

interface ProjectTimerTabProps {
  projectId: string;
  projectName: string;
  initialEntries: TimeEntryData[];
  totalDurationSeconds: number;
  activeTimer: {
    id: string;
    startedAt: Date | string;
    elapsedSeconds: number;
    userId: string | null;
    userName: string | null;
    taskDescription?: string | null;
    taskId?: string | null;
  } | null;
  currentUserRole?: string;
  currentUserId?: string;
  tasks?: Array<{ id: string; title: string }>;
}

export function ProjectTimerTab({
  projectId,
  projectName,
  initialEntries,
  totalDurationSeconds,
  activeTimer,
  currentUserRole,
  currentUserId,
  tasks = [],
}: ProjectTimerTabProps) {
  const router = useRouter();
  const isClient = currentUserRole === "CLIENT";

  // State
  const [entries, setEntries] = useState<TimeEntryData[]>(initialEntries);
  const [serverActiveTimer, setServerActiveTimer] = useState(activeTimer);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Form states
  const [startTaskDescription, setStartTaskDescription] = useState("");
  const [startTaskId, setStartTaskId] = useState<string>("none");
  const [stopTaskDescription, setStopTaskDescription] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimeEntryData | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editStartedAt, setEditStartedAt] = useState("");
  const [editEndedAt, setEditEndedAt] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now] = useState(() => Date.now());

  // Live timer ticker
  const [sessionSeconds, setSessionSeconds] = useState(() => {
    if (!activeTimer) return 0;
    const started = new Date(activeTimer.startedAt).getTime();
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
  });

  useEffect(() => {
    if (!serverActiveTimer) return;

    const startedTime = new Date(serverActiveTimer.startedAt).getTime();
    const interval = setInterval(() => {
      setSessionSeconds(Math.max(0, Math.floor((Date.now() - startedTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [serverActiveTimer]);

  // Polling for live entries and active timer updates (15s)
  useEffect(() => {
    const pollEntries = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/time-entries`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data);
        }

        const activeRes = await fetch(`/api/timer/active`);
        if (activeRes.ok) {
          const activeData = await activeRes.json();
          if (activeData.activeTimer && activeData.activeTimer.projectId === projectId) {
            setServerActiveTimer(activeData.activeTimer);
          } else if (!isClient) {
            // Check if someone else is running on this project
            const statusRes = await fetch(`/api/projects/${projectId}`);
            if (statusRes.ok) {
              const pData = await statusRes.json();
              setServerActiveTimer(pData.activeTimer || null);
            }
          }
        }
      } catch {
        // Silently ignore polling hiccups
      }
    };

    const interval = setInterval(pollEntries, 15000);
    return () => clearInterval(interval);
  }, [projectId, isClient]);

  // Start timer
  const handleStartTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTaskDescription.trim() || startTaskDescription.trim().length < 3) {
      toast.error("Task description must be at least 3 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/timer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription: startTaskDescription.trim(),
          taskId: startTaskId !== "none" ? startTaskId : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start timer");
      }

      const autoStoppedMsg = data.autoStoppedProjectName
        ? ` (Previous timer on "${data.autoStoppedProjectName}" was stopped)`
        : "";
      toast.success(`Timer started.${autoStoppedMsg}`);

      setServerActiveTimer(data.entry);
      setStartModalOpen(false);
      window.dispatchEvent(new CustomEvent("timer-changed"));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start timer");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stop timer
  const handleStopTimer = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription: stopTaskDescription.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to stop timer");
      }

      toast.success("Timer stopped.");
      setServerActiveTimer(null);
      setStopModalOpen(false);
      window.dispatchEvent(new CustomEvent("timer-changed"));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to stop timer");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit time entry
  const openEditModal = (entry: TimeEntryData) => {
    setEditingEntry(entry);
    setEditDescription(entry.taskDescription || entry.notes || "");
    setEditStartedAt(
      entry.startedAt ? new Date(entry.startedAt).toISOString().slice(0, 16) : ""
    );
    setEditEndedAt(
      entry.endedAt ? new Date(entry.endedAt).toISOString().slice(0, 16) : ""
    );
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/time-entries/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: editStartedAt ? new Date(editStartedAt).toISOString() : undefined,
          endedAt: editEndedAt ? new Date(editEndedAt).toISOString() : undefined,
          taskDescription: editDescription.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update time entry");
      }

      toast.success("Time entry updated.");
      setEditModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update time entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entry: TimeEntryData) => {
    if (!confirm("Are you sure you want to delete this recorded time entry?")) return;

    try {
      const res = await fetch(`/api/time-entries/${entry.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete time entry");
      }

      toast.success("Time entry deleted.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete time entry");
    }
  };

  const isAdmin = currentUserRole === "ADMIN";
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const pendingApprovalCount = entries.filter((e) => e.status !== "RUNNING" && e.endedAt && !e.approvedAt).length;

  const setApproval = async (entry: TimeEntryData, approve: boolean) => {
    setApprovingId(entry.id);
    try {
      const res = await fetch(`/api/time-entries/${entry.id}/approve`, { method: approve ? "POST" : "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update approval");
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, approvedAt: approve ? new Date().toISOString() : null } : e))
      );
      toast.success(approve ? "Time shared — now visible to the client" : "Hidden from the client");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update approval");
    } finally {
      setApprovingId(null);
    }
  };

  const approveAllPending = async () => {
    setApprovingId("all");
    try {
      const res = await fetch(`/api/projects/${projectId}/time-entries/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not approve entries");
      const stamp = new Date().toISOString();
      setEntries((prev) => prev.map((e) => (e.status !== "RUNNING" && e.endedAt && !e.approvedAt ? { ...e, approvedAt: stamp } : e)));
      toast.success(`${data.approved} entr${data.approved === 1 ? "y" : "ies"} approved`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not approve entries");
    } finally {
      setApprovingId(null);
    }
  };

  // Compute time per task for breakdown (Spec 4.5)
  const taskBreakdown = entries.reduce((acc, entry) => {
    if (entry.status === "RUNNING") return acc;
    const key = entry.taskDescription || entry.notes || "General Project Work";
    acc[key] = (acc[key] || 0) + (entry.durationSeconds || 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Client Mode View (Spec 4.5) */}
      {isClient ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Time Tracked</p>
                  <p className="text-lg font-bold font-mono tracking-tight text-foreground">
                    {formatDuration(totalDurationSeconds)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Currently Working</p>
                  {serverActiveTimer ? (
                    <p className="text-sm font-semibold text-foreground">
                      {serverActiveTimer.userName || "Team member"}
                      <span className="block text-[11px] text-muted-foreground truncate max-w-[200px]">
                        {serverActiveTimer.taskDescription || "Working on project"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No active session</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2 lg:col-span-1">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Recorded Sessions</p>
                  <p className="text-lg font-bold font-mono tracking-tight text-foreground">
                    {entries.filter((e) => e.status !== "RUNNING").length} session
                    {entries.filter((e) => e.status !== "RUNNING").length === 1 ? "" : "s"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Per Task Breakdown */}
          {Object.keys(taskBreakdown).length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  Time per Task / Scope
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 divide-y text-xs">
                {Object.entries(taskBreakdown).map(([taskName, duration]) => (
                  <div key={taskName} className="flex items-center justify-between py-2.5">
                    <span className="font-medium text-foreground truncate max-w-md">
                      {taskName}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-primary">
                      {formatDuration(duration)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Entries List (No rates/costs) */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                Recent Work Sessions
              </CardTitle>
              <p className="text-[11px] text-muted-foreground font-normal">
                Time appears here once the team shares it with you.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Team Member</TableHead>
                    <TableHead>Task / Work Done</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                        No work sessions logged yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id} className="text-xs">
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatDate(entry.startedAt)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.user?.name || "Team Member"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-sm truncate">
                          {entry.taskDescription || entry.notes || "Project work"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground whitespace-nowrap">
                          {entry.status === "RUNNING" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Live</span>
                          ) : (
                            formatDuration(entry.durationSeconds)
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Employee / Admin Mode (Spec 4.4) */
        <div className="space-y-6">
          {/* Active Timer Card / Start Control */}
          <Card className={serverActiveTimer ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {serverActiveTimer ? (
                      <span className="relative flex size-2.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                      </span>
                    ) : (
                      <Clock className="size-4 text-muted-foreground" />
                    )}
                    <h3 className="text-sm font-semibold tracking-tight">
                      {serverActiveTimer ? "Active Work Session" : "Project Timer"}
                    </h3>
                  </div>

                  {serverActiveTimer ? (
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {serverActiveTimer.userName || "Team member"} is working
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {serverActiveTimer.taskDescription || "Working on project"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Track billable or production hours directly on this project.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {serverActiveTimer && (
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        Elapsed
                      </span>
                      <span className="font-mono text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                        {formatTimerClock(sessionSeconds)}
                      </span>
                    </div>
                  )}

                  {serverActiveTimer ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setStopTaskDescription(serverActiveTimer.taskDescription || "");
                        setStopModalOpen(true);
                      }}
                    >
                      <Square className="size-3.5 fill-current" />
                      Stop Timer
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setStartModalOpen(true)}
                    >
                      <Play className="size-3.5 fill-current" />
                      Start Timer
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Entries Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Recorded Sessions ({entries.length})
              </h3>
              <div className="flex items-center gap-2 text-xs">
                {isAdmin && pendingApprovalCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={approveAllPending}
                    disabled={approvingId !== null}
                  >
                    {approvingId === "all" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                    Share all with client ({pendingApprovalCount})
                  </Button>
                )}
                <span className="text-muted-foreground">Total Time:</span>
                <span className="font-mono font-bold text-primary">
                  {formatDuration(totalDurationSeconds)}
                </span>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Ended</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Task / Description</TableHead>
                      <TableHead>Client View</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                          No time entries recorded yet. Click &quot;Start Timer&quot; to begin.
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries.map((entry) => {
                        const isRunning = entry.status === "RUNNING";
                        const isOwner = entry.user?.id === currentUserId;
                        const canEdit =
                          currentUserRole === "ADMIN" ||
                          (isOwner &&
                            entry.createdAt &&
                            now - new Date(entry.createdAt).getTime() <= 24 * 60 * 60 * 1000);

                        return (
                          <TableRow key={entry.id} className="text-xs">
                            <TableCell className="font-medium whitespace-nowrap">
                              {formatDate(entry.startedAt)}
                            </TableCell>

                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {formatTime(entry.startedAt)}
                            </TableCell>

                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {isRunning ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Running…
                                </span>
                              ) : entry.endedAt ? (
                                formatTime(entry.endedAt)
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            <TableCell className="font-mono font-semibold tabular-nums whitespace-nowrap">
                              {isRunning ? (
                                <span className="text-emerald-600 dark:text-emerald-400">Live</span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span>{formatDuration(entry.durationSeconds)}</span>
                                  {entry.flaggedForReview && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                                      title="Session exceeded 12 hours - flagged for review"
                                    >
                                      <AlertTriangle className="size-3" /> Flagged
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              {entry.user ? (
                                <span className="font-medium text-foreground">
                                  {entry.user.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-muted-foreground max-w-[220px] truncate">
                              {entry.taskDescription || entry.notes || entry.task?.title || "—"}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              {isRunning ? (
                                <span className="text-muted-foreground">—</span>
                              ) : entry.approvedAt ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="size-3" /> Shared with client
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                  Not shared
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-right whitespace-nowrap">
                              {isAdmin && !isRunning && entry.endedAt && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mr-1 h-7 gap-1 px-2 text-[11px]"
                                  onClick={() => setApproval(entry, !entry.approvedAt)}
                                  disabled={approvingId !== null}
                                  title={entry.approvedAt ? "Hide this time from the client" : "Show this time to the client"}
                                >
                                  {approvingId === entry.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : entry.approvedAt ? (
                                    <Undo2 className="size-3" />
                                  ) : (
                                    <CheckCircle2 className="size-3" />
                                  )}
                                  {entry.approvedAt ? "Hide from client" : "Share with client"}
                                </Button>
                              )}
                              {canEdit && !isRunning && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => openEditModal(entry)}
                                    title="Edit entry"
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteEntry(entry)}
                                    title="Delete entry"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Start Timer Modal (Spec 4.4: Task description required, min 3 chars, optional task link) */}
      <Dialog open={startModalOpen} onOpenChange={setStartModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleStartTimer}>
            <DialogHeader>
              <DialogTitle>Start Project Timer</DialogTitle>
              <DialogDescription>
                Track a work session on <strong>{projectName}</strong>. A task description is required.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="start-task-desc">Task Description *</Label>
                <Input
                  id="start-task-desc"
                  placeholder="What are you working on? (min 3 characters)"
                  value={startTaskDescription}
                  onChange={(e) => setStartTaskDescription(e.target.value)}
                  minLength={3}
                  required
                />
              </div>

              {tasks.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="start-task-select">Link to Existing Task (optional)</Label>
                  <Select value={startTaskId} onValueChange={setStartTaskId}>
                    <SelectTrigger id="start-task-select" className="h-9">
                      <SelectValue placeholder="Select task…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No task linked</SelectItem>
                      {tasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStartModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || startTaskDescription.trim().length < 3}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-3.5 fill-current" />
                )}
                Start Tracking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stop Timer Modal (Spec 4.4: Optionally edit description at stop) */}
      <Dialog open={stopModalOpen} onOpenChange={setStopModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stop Work Session</DialogTitle>
            <DialogDescription>
              Recorded session duration:{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatTimerClock(sessionSeconds)}
              </span>
              . You may update your task description before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="stop-modal-desc">Task Description</Label>
              <Input
                id="stop-modal-desc"
                placeholder="What did you accomplish?"
                value={stopTaskDescription}
                onChange={(e) => setStopTaskDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStopModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleStopTimer}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Square className="size-3.5 fill-current" />
              )}
              Stop Timer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Update the work description or adjust the session start and end times.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="edit-entry-desc">Task Description</Label>
              <Input
                id="edit-entry-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-start-time">Started At</Label>
                <Input
                  id="edit-start-time"
                  type="datetime-local"
                  value={editStartedAt}
                  onChange={(e) => setEditStartedAt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-end-time">Ended At</Label>
                <Input
                  id="edit-end-time"
                  type="datetime-local"
                  value={editEndedAt}
                  onChange={(e) => setEditEndedAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
