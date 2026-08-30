"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { createAccountingPeriodAction } from "@/lib/actions/periods";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function PeriodForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(new Date().getFullYear() + 1, 2, 31).toISOString().slice(0, 10), // March 31 of next year (FY standard)
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    const res = await createAccountingPeriodAction(data);
    setLoading(false);

    if (res.success) {
      toast.success("Accounting period created successfully");
      reset();
      router.refresh();
    } else {
      toast.error(res.message || "Failed to create period");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
          Period Name / FY Code
        </label>
        <input
          {...register("name", { required: "Period name is required" })}
          type="text"
          placeholder="e.g. FY 2026-27"
          className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-transparent"
        />
        {errors.name && <p className="text-red-500 text-[10px] mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
          Start Date
        </label>
        <input
          {...register("startDate", { required: "Start date is required" })}
          type="date"
          className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-transparent"
        />
        {errors.startDate && <p className="text-red-500 text-[10px] mt-1">{errors.startDate.message}</p>}
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">
          End Date
        </label>
        <input
          {...register("endDate", { required: "End date is required" })}
          type="date"
          className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-transparent"
        />
        {errors.endDate && <p className="text-red-500 text-[10px] mt-1">{errors.endDate.message}</p>}
      </div>

      <Button type="submit" disabled={loading} size="sm" className="w-full">
        {loading ? "Creating..." : "Create Period"}
      </Button>
    </form>
  );
}
