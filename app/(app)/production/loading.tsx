import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-96 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
