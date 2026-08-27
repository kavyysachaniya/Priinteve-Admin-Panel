import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("expenses:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

