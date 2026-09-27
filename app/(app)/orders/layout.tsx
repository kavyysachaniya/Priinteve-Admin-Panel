import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("orders:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
