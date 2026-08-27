export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getNoteDetail, noteToFormValues } from "@/lib/services/notes";
import { NoteForm } from "@/components/notes/note-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Edit Note — Priinteve Business OS" };

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getNoteDetail(id);
  if (!note) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={`Edit Note: ${note.title}`} description="Update note content and attachments." />
      <NoteForm noteId={note.id} defaultValues={noteToFormValues(note)} />
    </div>
  );
}

