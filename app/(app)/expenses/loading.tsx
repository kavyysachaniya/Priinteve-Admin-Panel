import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="rounded-lg border bg-card">
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
