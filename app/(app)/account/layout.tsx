import { requireAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";

// Open to every signed-in role (admin, employee, client): it only edits the user's own account.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }

  return <>{children}</>;
}
