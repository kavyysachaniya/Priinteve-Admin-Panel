import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-72" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
