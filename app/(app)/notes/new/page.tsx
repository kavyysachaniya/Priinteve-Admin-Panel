import { PageHeader } from "@/components/shared/page-header";
import { NoteForm } from "@/components/notes/note-form";

export const metadata = { title: "Create Note — Priinteve Business OS" };

export default function NewNotePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Create Note" description="Add a new quick note or operational memo." />
      <NoteForm />
    </div>
  );
}

