import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("customers:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
