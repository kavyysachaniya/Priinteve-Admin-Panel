import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold">Not found</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        The record you&apos;re looking for doesn&apos;t exist or may have been deleted.
      </p>
      <Button className="mt-5" asChild>
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
