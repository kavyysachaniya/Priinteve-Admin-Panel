"use client";

import Link from "next/link";
import { format } from "date-fns";
import { StickyNote, Pin, Tag, Edit, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteNoteAction, togglePinNoteAction } from "@/lib/actions/notes";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function NoteList({
  notes,
}: {
  notes: Array<{
    id: string;
    title: string;
    content: string;
    pinned: boolean;
    tags: string | null;
    createdAt: Date;
    customer: { id: string; name: string } | null;
    order: { id: string; number: string } | null;
    taskId?: string | null;
  }>;
}) {
  const router = useRouter();

  if (notes.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground italic">
        No notes created yet.
      </div>
    );
  }

  const handleTogglePin = async (id: string) => {
    const res = await togglePinNoteAction(id);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <Card
          key={note.id}
          className={`p-4 flex flex-col justify-between transition-all ${
            note.pinned ? "border-amber-500/40 bg-amber-500/5 shadow-sm" : "bg-card"
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <Link href={`/notes/${note.id}`} className="font-bold text-sm text-foreground hover:underline line-clamp-1">
                {note.title}
              </Link>
              <button
                onClick={() => handleTogglePin(note.id)}
                title={note.pinned ? "Unpin note" : "Pin note"}
                className={`p-1 rounded transition-colors ${
                  note.pinned ? "text-amber-600 bg-amber-500/20" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Pin className="size-3.5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed mb-3">
              {note.content}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t text-[11px] text-muted-foreground">
            {note.tags && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <Tag className="size-3 shrink-0" />
                <span className="truncate font-medium text-foreground">{note.tags}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-muted-foreground">
              <span>{format(new Date(note.createdAt), "d MMM yyyy")}</span>

              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="icon" className="size-6">
                  <Link href={`/notes/${note.id}/edit`}>
                    <Edit className="size-3 text-muted-foreground" />
                  </Link>
                </Button>

                <ConfirmDialog
                  title="Delete Note"
                  description="Are you sure you want to delete this note?"
                  onConfirm={async () => {
                    const res = await deleteNoteAction(note.id);
                    if (res.success) router.refresh();
                    return res;
                  }}
                  trigger={
                    <Button variant="ghost" size="icon" className="size-6 text-destructive">
                      <Trash2 className="size-3" />
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

