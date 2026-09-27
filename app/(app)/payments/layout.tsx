import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("payments:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
