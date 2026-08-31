"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck, UserX } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { activateUserAction, deactivateUserAction } from "@/lib/actions/users";
import type { UserStatus } from "@prisma/client";

export function UserStatusItem({
  userId,
  userName,
  status,
}: {
  userId: string;
  userName: string;
  status: UserStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status === "INACTIVE") {
    return (
      <DropdownMenuItem
        disabled={pending}
        onSelect={() => {
          startTransition(async () => {
            const result = await activateUserAction(userId);
            if (result.success) {
              toast.success("User activated");
              router.refresh();
            } else {
              toast.error(result.message);
            }
          });
        }}
      >
        <UserCheck className="size-4" /> Activate
      </DropdownMenuItem>
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={(e) => e.preventDefault()}>
          <UserX className="size-4" /> Deactivate
        </DropdownMenuItem>
      }
      title="Deactivate this user?"
      description={`"${userName}" will no longer be able to log in. This can be reversed later.`}
      confirmLabel="Deactivate"
      onConfirm={() => deactivateUserAction(userId)}
    />
  );
}
