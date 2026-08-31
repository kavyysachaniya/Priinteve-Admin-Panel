import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
