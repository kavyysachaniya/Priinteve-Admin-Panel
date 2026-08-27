import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white text-center font-sans text-gray-900">
        <div className="flex size-12 items-center justify-center rounded-full bg-gray-100">
          <FileQuestion className="size-6 text-gray-400" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Page not found</h1>
          <p className="mt-1 max-w-sm text-sm text-gray-500">This page doesn&apos;t exist.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to Dashboard
        </Link>
      </body>
    </html>
  );
}
