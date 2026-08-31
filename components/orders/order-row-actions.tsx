"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Factory } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { updateOrderStatusAction } from "@/lib/actions/orders";
import type { OrderStatus } from "@prisma/client";

/**
 * The same status transitions exposed on the order detail page
 * (components/orders/order-detail.tsx), adapted for the list's overflow
 * menu — calls the same server action, no new transitions invented.
 */
export function OrderRowActions({ id, status }: { id: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(next: OrderStatus) {
    startTransition(async () => {
      const result = await updateOrderStatusAction(id, next);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  if (status === "DRAFT") {
    return (
      <DropdownMenuItem disabled={pending} onSelect={() => setStatus("CONFIRMED")}>
        <CheckCircle2 className="size-4" /> Confirm Order
      </DropdownMenuItem>
    );
  }

  if (status === "CONFIRMED") {
    return (
      <DropdownMenuItem disabled={pending} onSelect={() => setStatus("IN_PRODUCTION")}>
        <Factory className="size-4" /> Send to Production
      </DropdownMenuItem>
    );
  }

  return null;
}
