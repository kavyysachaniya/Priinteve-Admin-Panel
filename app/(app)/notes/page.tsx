import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { NoteList } from "@/components/notes/note-list";
import { TablePagination } from "@/components/shared/table-pagination";
import { listNotes } from "@/lib/services/notes";
import { Plus } from "lucide-react";

export const metadata = { title: "Notes & Scratchpad — Priinteve Business OS" };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const data = await listNotes({ q: params.q, page });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes & Operations Scratchpad"
        description="Quick production specs, customer instructions, and internal task notes."
        actions={
          <Button asChild size="sm">
            <Link href="/notes/new">
              <Plus className="size-4 mr-1" /> New Note
            </Link>
          </Button>
        }
      />
      <NoteList notes={data.notes} />
      <TablePagination total={data.total} page={data.page} pageSize={data.pageSize} />
    </div>
  );
}
