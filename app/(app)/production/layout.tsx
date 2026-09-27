import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ProductionLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("production:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
