import { notFound } from "next/navigation";
import { getTaskDetail } from "@/lib/services/tasks";
import { TaskDetail } from "@/components/tasks/task-detail";

export const metadata = { title: "Task Details — Priinteve Business OS" };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskDetail(id);
  if (!task) notFound();

  return <TaskDetail task={task} />;
}

