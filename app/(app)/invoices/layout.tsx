import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function InvoicesLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("invoices:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
