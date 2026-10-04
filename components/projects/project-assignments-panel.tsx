"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, UserPlus, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { assignEmployeesAction } from "@/lib/actions/projects";
import { formatDateTime } from "@/lib/time-format";

interface AssignmentItem {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    email: string;
  };
  assignedAt: Date | string;
  assignedBy?: {
    id: string;
    name: string;
  } | null;
}

interface EmployeeOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function ProjectAssignmentsPanel({
  projectId,
  assignments,
  availableEmployees,
}: {
  projectId: string;
  assignments: AssignmentItem[];
  availableEmployees: EmployeeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    assignments.map((a) => a.employeeId)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleOpenModal = () => {
    setSelectedIds(assignments.map((a) => a.employeeId));
    setOpen(true);
  };

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveAssignments = async () => {
    setIsSubmitting(true);
    try {
      const res = await assignEmployeesAction(projectId, selectedIds);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update assignments");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSingle = async (employeeId: string, employeeName: string) => {
    if (removingId) return;
    setRemovingId(employeeId);
    try {
      const newIds = assignments
        .filter((a) => a.employeeId !== employeeId)
        .map((a) => a.employeeId);
      const res = await assignEmployeesAction(projectId, newIds);
      if (res.success) {
        toast.success(`${employeeName} unassigned.`);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove assignment");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="size-4 text-primary" />
          Assigned Team Members
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleOpenModal}>
              <UserPlus className="size-3.5" />
              Manage Team
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Assigned Team</DialogTitle>
              <DialogDescription>
                Select the employees who can work on this project, track time, and handle tasks.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-72 overflow-y-auto space-y-2 py-2">
              {availableEmployees.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">
                  No active employees available.
                </p>
              ) : (
                availableEmployees.map((emp) => {
                  const checked = selectedIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                        checked ? "bg-primary/5 border-primary/40" : "hover:bg-muted/40"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggle(emp.id)}
                      />
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[11px] bg-primary/10 text-primary font-medium">
                          {emp.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{emp.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{emp.email}</p>
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {emp.role}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSaveAssignments} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Save Team
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="pt-4 text-xs space-y-3">
        {assignments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="size-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="font-medium text-foreground mb-0.5">No Employees Assigned</p>
            <p className="text-[11px]">Click &quot;Manage Team&quot; above to assign employees to this project.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                      {assignment.employee.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate text-xs">
                      {assignment.employee.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{assignment.employee.email}</span>
                      <span>•</span>
                      <span>Assigned {formatDateTime(assignment.assignedAt)}</span>
                      {assignment.assignedBy && (
                        <span>by {assignment.assignedBy.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                  onClick={() => handleRemoveSingle(assignment.employeeId, assignment.employee.name)}
                  disabled={removingId === assignment.employeeId}
                  title="Remove assignment"
                >
                  {removingId === assignment.employeeId ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
