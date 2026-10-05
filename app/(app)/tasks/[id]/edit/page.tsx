export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

// Editing now happens in place on the task page; keep old links and bookmarks working.
export default async function EditTaskRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/tasks/${id}`);
}
