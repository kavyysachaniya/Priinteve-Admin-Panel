"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { addTaskCommentAction, deleteTaskCommentAction, updateTaskCommentAction } from "@/lib/actions/task-comments";
import { TASK_COMMENT_MAX } from "@/lib/validations/task-comments";
import { relativeTime } from "@/lib/format";

export interface CommentView {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: "ADMIN" | "EMPLOYEE" | "CLIENT";
  createdAt: string;
  editedAt: string | null;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function DeleteCommentItem({ commentId }: { commentId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Delete comment">
          <Trash2 className="size-3.5" />
        </Button>
      }
      title="Delete this comment?"
      description="This can't be undone."
      confirmLabel="Delete"
      onConfirm={() => deleteTaskCommentAction(commentId)}
    />
  );
}

function Comment({ comment, viewerId, isAdmin }: { comment: CommentView; viewerId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);
  const [pending, startTransition] = useTransition();
  const mine = comment.authorId === viewerId;

  function save() {
    startTransition(async () => {
      const result = await updateTaskCommentAction({ commentId: comment.id, body: text });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className="flex gap-2.5">
      <Avatar className="mt-0.5 size-7">
        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{initials(comment.authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs">
          <span className="font-semibold">{comment.authorName}</span>
          {comment.authorRole === "CLIENT" && <span className="rounded bg-amber-500/15 px-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">Client</span>}
          <span className="text-muted-foreground">
            {relativeTime(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
          </span>
          {!editing && (mine || isAdmin) && (
            <span className="ml-auto flex items-center">
              {mine && (
                <Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Edit comment" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" />
                </Button>
              )}
              <DeleteCommentItem commentId={comment.id} />
            </span>
          )}
        </div>
        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea rows={3} value={text} maxLength={TASK_COMMENT_MAX} onChange={(e) => setText(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setText(comment.body);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={pending || !text.trim()} onClick={save}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.body}</p>
        )}
      </div>
    </li>
  );
}

export function TaskComments({
  taskId,
  comments,
  viewerId,
  isAdmin,
}: {
  taskId: string;
  comments: CommentView[];
  viewerId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function post() {
    if (!text.trim()) return;
    startTransition(async () => {
      const result = await addTaskCommentAction({ taskId, body: text });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquare className="size-3.5" /> Comments{comments.length ? ` (${comments.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">No comments yet. Start the discussion below.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => (
              <Comment key={c.id} comment={c} viewerId={viewerId} isAdmin={isAdmin} />
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <Textarea
            rows={3}
            placeholder="Write a comment…  (Ctrl+Enter to post)"
            value={text}
            maxLength={TASK_COMMENT_MAX}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                post();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {text.length}/{TASK_COMMENT_MAX}
            </span>
            <Button type="button" size="sm" disabled={pending || !text.trim()} onClick={post}>
              {pending ? "Posting…" : "Comment"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
