"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { activateUserAction, deactivateUserAction } from "@/lib/actions/users";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  currentStatus: "ACTIVE" | "INACTIVE";
}

export function UserStatusToggle({ userId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      const action = currentStatus === "ACTIVE" ? deactivateUserAction : activateUserAction;
      const result = await action(userId);
      if (result.success) {
        toast.success(currentStatus === "ACTIVE" ? "User deactivated." : "User activated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Failed to update user status.");
      }
    });
  }

  return (
    <Button
      variant="outline"
      onClick={toggle}
      disabled={isPending}
      className={currentStatus === "ACTIVE" ? "text-destructive border-destructive/30 hover:bg-destructive/10" : ""}
    >
      {isPending ? "Updating…" : currentStatus === "ACTIVE" ? "Deactivate" : "Activate"}
    </Button>
  );
}
