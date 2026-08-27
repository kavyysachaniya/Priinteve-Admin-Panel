import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createUserAction } from "@/lib/actions/users";
import { UserForm } from "@/features/users/user-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add User" };

export default async function NewUserPage() {
  try {
    await requirePermission("users:manage");
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add User</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new team member account.</p>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <UserForm onSubmit={createUserAction} submitLabel="Create User" />
      </div>
    </div>
  );
}
