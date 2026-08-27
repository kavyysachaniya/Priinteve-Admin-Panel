export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/page-header";
import { TaskForm } from "@/components/tasks/task-form";

export const metadata = { title: "Create Task — Priinteve Business OS" };

export default function NewTaskPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Create Operational Task" description="Assign or schedule a new task." />
      <TaskForm />
    </div>
  );
}

