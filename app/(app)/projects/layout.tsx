import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("projects:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
