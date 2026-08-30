"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { createAccountAction } from "@/lib/actions/accounts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AccountForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      code: "",
      name: "",
      type: "ASSET" as const,
      description: "",
      openingBalance: 0,
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    const res = await createAccountAction(data);
    setLoading(false);

    if (res.success) {
      toast.success("Account created successfully");
      router.push("/accounts");
    } else {
      toast.error(res.message || "Failed to create account");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
          Account Code
        </label>
        <input
          {...register("code", { required: "Account code is required" })}
          type="text"
          placeholder="e.g. 1040"
          className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
          Account Name
        </label>
        <input
          {...register("name", { required: "Account name is required" })}
          type="text"
          placeholder="e.g. UPI Razorpay"
          className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
          Account Type
        </label>
        <select
          {...register("type", { required: true })}
          className="w-full text-xs px-3 py-2 border rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ASSET">Asset</option>
          <option value="LIABILITY">Liability</option>
          <option value="EQUITY">Equity</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
          Description
        </label>
        <textarea
          {...register("description")}
          placeholder="Optional notes or details about account usage"
          rows={3}
          className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
          Opening Balance (₹)
        </label>
        <input
          {...register("openingBalance")}
          type="number"
          step="0.01"
          placeholder="0.00"
          className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/accounts")}
          disabled={loading}
          size="sm"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Creating..." : "Create Account"}
        </Button>
      </div>
    </form>
  );
}
