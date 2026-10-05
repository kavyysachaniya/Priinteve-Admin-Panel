import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function TimesheetLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("timesheet:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
