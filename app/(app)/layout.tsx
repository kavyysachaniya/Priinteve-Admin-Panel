import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/session";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts only verifies the cookie's signature; this confirms a live session for an
  // active user (see the jwt callback in auth.ts) before any app page renders.
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
