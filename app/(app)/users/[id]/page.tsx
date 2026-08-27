import { requirePermission } from "@/lib/auth/session";
import { getUserById } from "@/lib/services/users";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, ArrowLeft } from "lucide-react";
import { UserStatusToggle } from "@/features/users/user-status-toggle";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const user = await getUserById(id);
  return { title: user ? `${user.name} · User` : "User Not Found" };
}

export default async function UserDetailPage({ params }: Props) {
  try {
    await requirePermission("users:manage");
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/users"><ArrowLeft className="w-4 h-4 mr-1" />Users</Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
          <Badge variant={user.status === "ACTIVE" ? "outline" : "destructive"} className={user.status === "ACTIVE" ? "text-green-600 border-green-300" : ""}>
            {user.status}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Account Details</h2>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">{user.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Role</p>
            <p className="font-medium">{user.role}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{user.status}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Login</p>
            <p className="font-medium">
              {user.lastLoginAt ? format(new Date(user.lastLoginAt), "dd MMM yyyy, HH:mm") : "Never"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Created</p>
            <p className="font-medium">{format(new Date(user.createdAt), "dd MMM yyyy")}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button asChild>
          <Link href={`/users/${user.id}/edit`}>
            <Edit className="w-4 h-4 mr-2" />
            Edit User
          </Link>
        </Button>
        <UserStatusToggle userId={user.id} currentStatus={user.status} />
      </div>
    </div>
  );
}
