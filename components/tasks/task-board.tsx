"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { moveTaskAction } from "@/lib/actions/tasks";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { TaskCardView, type BoardViewer } from "@/components/tasks/task-card";
import type { BoardTask } from "@/lib/services/tasks";
import type { TaskStatus } from "@prisma/client";

const COLUMNS: Array<{ status: TaskStatus; label: string; accent: string }> = [
  { status: "TODO", label: "To Do", accent: "bg-slate-500" },
  { status: "IN_PROGRESS", label: "In Progress", accent: "bg-blue-500" },
  { status: "COMPLETED", label: "Completed", accent: "bg-emerald-500" },
  { status: "CANCELLED", label: "Cancelled", accent: "bg-rose-400" },
];

type Columns = Record<TaskStatus, BoardTask[]>;

function groupByStatus(tasks: BoardTask[]): Columns {
  const cols: Columns = { TODO: [], IN_PROGRESS: [], COMPLETED: [], CANCELLED: [] };
  for (const t of tasks) cols[t.status].push(t);
  return cols;
}

function canDrag(task: BoardTask, viewer: BoardViewer) {
  return viewer.role !== "CLIENT" || task.createdById === viewer.id;
}

function SortableCard({ task, viewer }: { task: BoardTask; viewer: BoardViewer }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canDrag(task, viewer),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "manipulation" }}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
    >
      <TaskCardView task={task} viewer={viewer} />
    </div>
  );
}

function Column({
  status,
  label,
  accent,
  tasks,
  viewer,
  onAdd,
}: {
  status: TaskStatus;
  label: string;
  accent: string;
  tasks: BoardTask[];
  viewer: BoardViewer;
  /** Present when the viewer can add a task in this column. */
  onAdd?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex min-w-[17rem] flex-1 flex-col rounded-xl border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={`size-2 rounded-full ${accent}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wide">{label}</h3>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title={`Add a task to ${label}`}
            aria-label={`Add a task to ${label}`}
            className="ml-auto inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[55vh] flex-1 flex-col gap-2 rounded-b-xl px-2 pb-2 transition ${isOver ? "bg-primary/5" : ""}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} viewer={viewer} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="py-6 text-center text-[11px] text-muted-foreground">Drop tasks here</p>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-xs text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <Plus className="size-3.5" /> Add task
          </button>
        )}
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks,
  viewer,
  projects,
  fixedProjectId,
}: {
  tasks: BoardTask[];
  viewer: BoardViewer;
  /** Projects the viewer can create tasks in. Without them the "Add task" buttons are hidden. */
  projects?: Array<{ id: string; name: string }>;
  fixedProjectId?: string;
}) {
  const router = useRouter();
  const [addStatus, setAddStatus] = useState<TaskStatus | null>(null);
  const [addSeq, setAddSeq] = useState(0);
  // Clients can only raise new requests (To Do); everyone else can add to any column.
  const canAddIn = (status: TaskStatus) =>
    Boolean(projects?.length) && (viewer.role !== "CLIENT" || status === "TODO");
  const [cols, setCols] = useState<Columns>(() => groupByStatus(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshot = useRef<Columns>(cols);
  const [syncedTasks, setSyncedTasks] = useState(tasks);

  // Re-sync from the server after a refresh, but never mid-drag.
  if (tasks !== syncedTasks && activeId === null) {
    setSyncedTasks(tasks);
    setCols(groupByStatus(tasks));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const findColumn = (id: string, from: Columns = cols): TaskStatus | undefined =>
    COLUMNS.some((c) => c.status === id)
      ? (id as TaskStatus)
      : COLUMNS.find((c) => from[c.status].some((t) => t.id === id))?.status;

  const handleDragStart = (event: DragStartEvent) => {
    snapshot.current = cols;
    setActiveId(String(event.active.id));
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const from = findColumn(activeKey);
    const to = findColumn(overKey);
    if (!from || !to || from === to) return;

    setCols((prev) => {
      const item = prev[from].find((t) => t.id === activeKey);
      if (!item) return prev;
      const overIndex = prev[to].findIndex((t) => t.id === overKey);
      const translated = active.rect.current.translated;
      const isBelow = Boolean(translated && translated.top > over.rect.top + over.rect.height / 2);
      const insertAt = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : prev[to].length;
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== activeKey),
        [to]: [...prev[to].slice(0, insertAt), { ...item, status: to }, ...prev[to].slice(insertAt)],
      };
    });
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const activeKey = String(active.id);
    setActiveId(null);

    let next = cols;
    const column = findColumn(activeKey, next);
    if (!column) return;

    if (over) {
      const overKey = String(over.id);
      const overColumn = findColumn(overKey, next);
      if (overColumn === column) {
        const oldIndex = next[column].findIndex((t) => t.id === activeKey);
        const newIndex = next[column].findIndex((t) => t.id === overKey);
        if (newIndex >= 0 && oldIndex !== newIndex) {
          next = { ...next, [column]: arrayMove(next[column], oldIndex, newIndex) };
          setCols(next);
        }
      }
    }

    const list = next[column];
    const index = list.findIndex((t) => t.id === activeKey);
    const aboveId = list[index - 1]?.id ?? null;
    const belowId = list[index + 1]?.id ?? null;

    const before = snapshot.current;
    const beforeColumn = findColumn(activeKey, before);
    const beforeList = beforeColumn ? before[beforeColumn] : [];
    const beforeIndex = beforeList.findIndex((t) => t.id === activeKey);
    if (
      beforeColumn === column &&
      (beforeList[beforeIndex - 1]?.id ?? null) === aboveId &&
      (beforeList[beforeIndex + 1]?.id ?? null) === belowId
    ) {
      return;
    }

    const res = await moveTaskAction(activeKey, { status: column, aboveId, belowId });
    if (!res.success) {
      setCols(before);
      toast.error(res.message ?? "Could not move task");
      return;
    }
    router.refresh();
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setCols(snapshot.current);
  };

  const activeTask = activeId ? COLUMNS.flatMap((c) => cols[c.status]).find((t) => t.id === activeId) : undefined;
  const visibleColumns = COLUMNS.filter((c) => c.status !== "CANCELLED" || cols.CANCELLED.length > 0);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {visibleColumns.map((c) => (
          <Column
            key={c.status}
            {...c}
            tasks={cols[c.status]}
            viewer={viewer}
            onAdd={
              canAddIn(c.status)
                ? () => {
                    setAddSeq((n) => n + 1);
                    setAddStatus(c.status);
                  }
                : undefined
            }
          />
        ))}
      </div>
      {projects && projects.length > 0 && (
        <TaskCreateDialog
          key={addSeq}
          projects={projects}
          fixedProjectId={fixedProjectId}
          defaultStatus={addStatus ?? "TODO"}
          canStartTimer={viewer.role !== "CLIENT"}
          open={addStatus !== null}
          onOpenChange={(next) => !next && setAddStatus(null)}
          showTrigger={false}
        />
      )}
      <DragOverlay>{activeTask ? <TaskCardView task={activeTask} viewer={viewer} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
