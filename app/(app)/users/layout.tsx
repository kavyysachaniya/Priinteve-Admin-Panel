import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("users:manage");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
