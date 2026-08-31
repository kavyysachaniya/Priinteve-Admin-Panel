"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        className="size-7 text-muted-foreground hover:text-emerald-600 transition-colors"
        title="Activate User"
        onClick={() => {
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
        <UserCheck className="size-3.5" />
      </Button>
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Deactivate / Remove User"
        >
          <Trash2 className="size-3.5" />
        </Button>
      }
      title="Deactivate this user?"
      description={`"${userName}" will no longer be able to log in. This can be reversed later.`}
      confirmLabel="Deactivate"
      onConfirm={() => deactivateUserAction(userId)}
    />
  );
}
