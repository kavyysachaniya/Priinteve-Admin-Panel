import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function NotesLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("notes:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
