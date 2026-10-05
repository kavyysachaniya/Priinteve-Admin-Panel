export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getTaskDetail } from "@/lib/services/tasks";
import { listTaskAttachments } from "@/lib/services/attachments";
import { isStorageConfigured } from "@/lib/services/storage";
import { getSession } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import { TaskDetail } from "@/components/tasks/task-detail";
import { TaskAttachments } from "@/components/tasks/task-attachments";

export const metadata = { title: "Task Details — Priinteve Business OS" };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskDetail(id);
  if (!task) notFound();

  const [user, attachments] = await Promise.all([getSession(), listTaskAttachments(task.id)]);
  // Mirrors the server-side rule in lib/services/attachments.ts (the actions enforce it).
  const canUpload =
    !!user && roleHasPermission(user.role, "tasks:edit") && (user.role !== "CLIENT" || task.createdById === user.id);

  return (
    <TaskDetail
      task={task}
      attachments={
        <TaskAttachments
          taskId={task.id}
          canUpload={canUpload}
          currentUserId={user?.id ?? ""}
          isAdmin={user?.role === "ADMIN"}
          storageConfigured={isStorageConfigured()}
          attachments={attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        />
      }
    />
  );
}
