"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { togglePeriodStatusAction } from "@/lib/actions/periods";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Unlock } from "lucide-react";

export function PeriodToggle({ id, isOpen }: { id: string; isOpen: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const res = await togglePeriodStatusAction(id);
    setLoading(false);

    if (res.success) {
      toast.success(res.message || "Period status updated");
      router.refresh();
    } else {
      toast.error(res.message || "Failed to update period");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs flex items-center gap-1.5 h-7 px-2"
      onClick={handleToggle}
      disabled={loading}
    >
      {isOpen ? (
        <>
          <Lock className="size-3.5 text-red-500" /> Close Period
        </>
      ) : (
        <>
          <Unlock className="size-3.5 text-emerald-500" /> Open Period
        </>
      )}
    </Button>
  );
}
