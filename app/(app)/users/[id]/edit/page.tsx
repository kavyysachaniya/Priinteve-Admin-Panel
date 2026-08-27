import { requirePermission } from "@/lib/auth/session";
import { getUserById } from "@/lib/services/users";
import { redirect, notFound } from "next/navigation";
import { updateUserAction } from "@/lib/actions/users";
import { UserForm } from "@/features/users/user-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit User" };

interface Props { params: Promise<{ id: string }> }

export default async function EditUserPage({ params }: Props) {
  try {
    await requirePermission("users:manage");
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  async function handleUpdate(values: Parameters<typeof updateUserAction>[1]) {
    "use server";
    return updateUserAction(id, values);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/users/${id}`}><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit User</h1>
        <p className="text-muted-foreground text-sm mt-1">Update {user.name}&apos;s account details.</p>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <UserForm
          defaultValues={{ name: user.name, email: user.email, role: user.role, status: user.status, password: "" }}
          onSubmit={handleUpdate}
          submitLabel="Save Changes"
          isEdit
        />
      </div>
    </div>
  );
}
