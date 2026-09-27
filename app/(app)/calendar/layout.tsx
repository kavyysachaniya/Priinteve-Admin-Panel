import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("calendar:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
