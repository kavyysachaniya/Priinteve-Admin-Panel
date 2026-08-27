import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function VendorsLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("vendors:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
