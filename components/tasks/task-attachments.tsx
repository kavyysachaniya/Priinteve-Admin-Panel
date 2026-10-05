"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageIcon, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteRowButton } from "@/components/shared/row-actions";
import {
  confirmTaskAttachmentAction,
  deleteTaskAttachmentAction,
  requestTaskAttachmentUploadAction,
} from "@/lib/actions/attachments";
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES } from "@/lib/validations/attachments";
import { formatDate } from "@/lib/format";

export interface TaskAttachmentView {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedById: string | null;
  createdAt: string;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RemoveAttachmentItem({ attachmentId, taskId, fileName }: { attachmentId: string; taskId: string; fileName: string }) {
  return (
    <ConfirmDialog
      trigger={<DeleteRowButton label="Remove file" />}
      title="Remove this file?"
      description={`"${fileName}" will be removed from the task.`}
      confirmLabel="Remove"
      onConfirm={() => deleteTaskAttachmentAction(attachmentId, taskId)}
    />
  );
}

export function TaskAttachments({
  taskId,
  attachments,
  canUpload,
  currentUserId,
  isAdmin,
  storageConfigured,
}: {
  taskId: string;
  attachments: TaskAttachmentView[];
  canUpload: boolean;
  currentUserId: string;
  isAdmin: boolean;
  storageConfigured: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function uploadOne(file: File): Promise<boolean> {
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error(`${file.name}: files must be 25 MB or smaller.`);
      return false;
    }
    const ticket = await requestTaskAttachmentUploadAction({ taskId, fileName: file.name, mimeType: file.type, size: file.size });
    if (!ticket.success) {
      toast.error(`${file.name}: ${ticket.message}`);
      return false;
    }
    try {
      const res = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": ticket.contentType }, body: file });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      toast.error(`${file.name}: upload to storage failed. Check the bucket's CORS settings allow this site.`);
      return false;
    }
    const confirmed = await confirmTaskAttachmentAction({ taskId, key: ticket.key, fileName: file.name });
    if (!confirmed.success) {
      toast.error(`${file.name}: ${confirmed.message}`);
      return false;
    }
    return true;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    let added = 0;
    for (const file of Array.from(files)) {
      setUploading(file.name);
      if (await uploadOne(file)) added++;
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    if (added) {
      toast.success(added === 1 ? "File attached" : `${added} files attached`);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <Paperclip className="size-3.5" /> Attachments
        </CardTitle>
        {canUpload && storageConfigured && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button size="sm" variant="outline" disabled={uploading !== null} onClick={() => input.current?.click()}>
              <Upload className="mr-1 size-3.5" />
              {uploading ? `Uploading ${uploading}…` : "Add files"}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent className="text-xs">
        {attachments.length === 0 ? (
          <p className="italic text-muted-foreground">
            {storageConfigured ? "No files yet. Images, PDF, Word and XML files up to 25 MB." : "File storage isn't configured on the server yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {attachments.map((file) => (
              <li key={file.id} className="flex items-center gap-2 px-3 py-2">
                {file.mimeType?.startsWith("image/") ? (
                  <ImageIcon className="size-4 text-muted-foreground" />
                ) : (
                  <FileText className="size-4 text-muted-foreground" />
                )}
                <a
                  href={`/api/attachments/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate font-medium text-primary hover:underline"
                >
                  {file.fileName}
                </a>
                <span className="shrink-0 text-muted-foreground">
                  {formatSize(file.fileSize)} · {formatDate(file.createdAt)}
                </span>
                {(isAdmin || file.uploadedById === currentUserId) && (
                  <RemoveAttachmentItem attachmentId={file.id} taskId={taskId} fileName={file.fileName} />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
