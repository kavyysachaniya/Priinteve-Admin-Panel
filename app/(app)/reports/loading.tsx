import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
