export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getNoteDetail } from "@/lib/services/notes";
import { NoteDetail } from "@/components/notes/note-detail";

export const metadata = { title: "Note Details — Priinteve Business OS" };

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getNoteDetail(id);
  if (!note) notFound();

  return <NoteDetail note={note} />;
}

