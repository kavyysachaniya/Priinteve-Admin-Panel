"use client";

import { TaskBoard } from "@/components/tasks/task-board";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import type { BoardTask } from "@/lib/services/tasks";

export function ProjectTasksTab({
  projectId,
  projectName,
  tasks,
  currentUserId,
  currentUserRole,
}: {
  projectId: string;
  projectName: string;
  tasks: BoardTask[];
  currentUserId: string;
  currentUserRole: "ADMIN" | "EMPLOYEE" | "CLIENT";
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Project Tasks</h2>
          <p className="text-xs text-muted-foreground">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} tracked for this project. Drag cards between columns to update status.
          </p>
        </div>
        <TaskCreateDialog projects={[{ id: projectId, name: projectName }]} fixedProjectId={projectId} />
      </div>
      <TaskBoard tasks={tasks} viewer={{ id: currentUserId, role: currentUserRole }} />
    </div>
  );
}
