import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-[600px] rounded-lg" />
    </div>
  );
}
