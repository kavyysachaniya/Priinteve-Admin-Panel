import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("tasks:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
