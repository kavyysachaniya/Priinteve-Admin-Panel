"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

/** URL-driven single-date filter, matching TableFilterSelect's URL-param convention. */
export function TableDateFilter({ paramName, label }: { paramName: string; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramName) ?? "";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) params.set(paramName, e.target.value);
    else params.delete(paramName);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Input
      type="date"
      value={value}
      onChange={handleChange}
      aria-label={label ?? "Filter by date"}
      className="h-9 w-auto"
    />
  );
}
