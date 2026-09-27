import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePermission("products:view");
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
