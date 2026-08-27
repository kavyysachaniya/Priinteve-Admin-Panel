"use client";

import Link from "next/link";
import { format } from "date-fns";
import { StickyNote, Tag, Calendar, Pin, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteNoteAction, togglePinNoteAction } from "@/lib/actions/notes";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function NoteDetail({ note }: { note: any }) {
  const router = useRouter();

  const handleTogglePin = async () => {
    const res = await togglePinNoteAction(note.id);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{note.title}</h1>
            {note.pinned && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                <Pin className="size-3 fill-amber-600" /> Pinned
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Created on {format(new Date(note.createdAt), "PPP p")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTogglePin}>
            <Pin className="size-3.5 mr-1" /> {note.pinned ? "Unpin" : "Pin"}
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link href={`/notes/${note.id}/edit`}>
              <Edit className="size-3.5 mr-1" /> Edit
            </Link>
          </Button>

          <ConfirmDialog
            title="Delete Note"
            description="Are you sure you want to delete this note?"
            onConfirm={async () => {
              const res = await deleteNoteAction(note.id);
              if (res.success) router.push("/notes");
              return res;
            }}
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-3.5" />
              </Button>
            }
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Note Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <p className="whitespace-pre-wrap leading-relaxed text-foreground text-sm">{note.content}</p>

          {note.tags && (
            <div className="pt-3 border-t flex items-center gap-2">
              <Tag className="size-3.5 text-muted-foreground" />
              <div className="flex flex-wrap gap-1">
                {note.tags.split(",").map((t: string) => (
                  <span key={t} className="bg-muted px-2 py-0.5 rounded font-medium text-[11px]">
                    {t.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(note.customer || note.order) && (
            <div className="pt-3 border-t space-y-1 text-xs">
              {note.customer && (
                <div>
                  <span className="text-muted-foreground">Attached Customer:</span>{" "}
                  <Link href={`/customers/${note.customer.id}`} className="font-semibold text-primary hover:underline">
                    {note.customer.name}
                  </Link>
                </div>
              )}
              {note.order && (
                <div>
                  <span className="text-muted-foreground">Attached Order:</span>{" "}
                  <Link href={`/orders/${note.order.id}`} className="font-semibold text-primary hover:underline">
                    {note.order.number}
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

