import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function QuotationsLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("quotations:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
