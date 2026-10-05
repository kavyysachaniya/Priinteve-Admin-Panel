import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CompanionLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("companion:use");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
