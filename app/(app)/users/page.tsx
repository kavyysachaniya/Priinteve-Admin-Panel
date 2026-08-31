import { Suspense } from "react";
import { listUsers } from "@/lib/services/users";
import { requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Users, Eye, Pencil } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { QuickAction, RowActions, RowActionsBar } from "@/components/shared/row-actions";
import { UserStatusItem } from "@/components/users/user-status-item";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

async function UserList() {
  const users = await listUsers();

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No users found"
        description="Add a team member to give them access to Priinteve."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden xl:table-cell">Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Last Login</TableHead>
            <TableHead className="hidden md:table-cell">Created</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="hidden text-muted-foreground xl:table-cell">{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={user.status === "ACTIVE" ? "outline" : "destructive"}
                  className={user.status === "ACTIVE" ? "text-success border-success/40" : ""}
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {user.lastLoginAt ? format(new Date(user.lastLoginAt), "dd MMM yyyy, HH:mm") : "Never"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {format(new Date(user.createdAt), "dd MMM yyyy")}
              </TableCell>
              <TableCell>
                <RowActionsBar>
                  <QuickAction icon={Eye} label="View" href={`/users/${user.id}`} />
                  <QuickAction icon={Pencil} label="Edit" href={`/users/${user.id}/edit`} />
                  <RowActions>
                    <UserStatusItem userId={user.id} userName={user.name} status={user.status} />
                  </RowActions>
                </RowActionsBar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserListSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
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
            <UserPlus className="size-4" />
            Add User
          </Link>
        </Button>
      </div>
      <Suspense fallback={<UserListSkeleton />}>
        <UserList />
      </Suspense>
    </div>
  );
}
