export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getTaskDetail, taskToFormValues } from "@/lib/services/tasks";
import { TaskForm } from "@/components/tasks/task-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Edit Task — Priinteve Business OS" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskDetail(id);
  if (!task) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={`Edit Task: ${task.title}`} description="Update task details and due dates." />
      <TaskForm taskId={task.id} defaultValues={taskToFormValues(task)} />
    </div>
  );
}

