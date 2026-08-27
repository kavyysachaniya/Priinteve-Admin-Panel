import { Suspense } from "react";
import { listUsers } from "@/lib/services/users";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

async function UserList() {
  const users = await listUsers();

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Login</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-medium">{user.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
              <td className="px-4 py-3">
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant={user.status === "ACTIVE" ? "outline" : "destructive"} className={user.status === "ACTIVE" ? "text-green-600 border-green-300" : ""}>
                  {user.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {user.lastLoginAt ? format(new Date(user.lastLoginAt), "dd MMM yyyy, HH:mm") : "Never"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {format(new Date(user.createdAt), "dd MMM yyyy")}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/users/${user.id}`}>View</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No users found.</p>
        </div>
      )}
    </div>
  );
}

export default async function UsersPage() {
  try {
    await requirePermission("users:manage");
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage team members and their access levels.</p>
        </div>
        <Button asChild>
          <Link href="/users/new">
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Link>
        </Button>
      </div>
      <Suspense fallback={<div className="h-48 rounded-xl border bg-muted animate-pulse" />}>
        <UserList />
      </Suspense>
    </div>
  );
}
