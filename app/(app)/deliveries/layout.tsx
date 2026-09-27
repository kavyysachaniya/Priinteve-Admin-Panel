import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DeliveriesLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("deliveries:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
