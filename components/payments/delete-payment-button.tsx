"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deletePaymentAction } from "@/lib/actions/payments";

export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-950/30"
        >
          <Trash2 className="size-4 text-red-600 dark:text-red-400 mr-1.5" /> Delete Payment
        </Button>
      }
      title="Delete this payment?"
      description="The invoice's outstanding balance and status will be recalculated. This can't be undone."
      confirmLabel="Delete"
      onConfirm={async () => {
        const result = await deletePaymentAction(paymentId);
        if (result.success) router.push("/payments");
        return result;
      }}
    />
  );
}
