import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createUserAction } from "@/lib/actions/users";
import { UserForm } from "@/features/users/user-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add User" };

import { prisma } from "@/lib/prisma";

export default async function NewUserPage({
  searchParams,
}: {
  searchParams?: Promise<{ customerId?: string; role?: string }>;
}) {
  try {
    await requirePermission("users:manage");
  } catch {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const defaultRole = params?.role === "CLIENT" || params?.customerId ? "CLIENT" : "EMPLOYEE";
  const defaultCustomerId = params?.customerId ?? "";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add User</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new team member or client account.</p>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <UserForm
          customers={customers}
          defaultValues={{ role: defaultRole, customerId: defaultCustomerId }}
          onSubmit={createUserAction}
          submitLabel="Create User"
        />
      </div>
    </div>
  );
}
