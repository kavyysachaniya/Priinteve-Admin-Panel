"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmInstallerUploadAction, requestInstallerUploadAction } from "@/lib/actions/companion";
import { formatDateTime } from "@/lib/format";

export interface InstallerView {
  fileName: string;
  size: number | null;
  version: string | null;
  uploadedAt: string | null;
}

export function InstallerUpload({ current, storageConfigured }: { current: InstallerView | null; storageConfigured: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  /** SHA-256 of the file, so the desktop app can verify what it downloads before installing it. */
  async function sha256Hex(file: File): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // XHR (not fetch) so a 100+ MB upload can show progress.
  function put(url: string, contentType: string, file: File) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("network"));
      xhr.send(file);
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setProgress(0);
    try {
      setChecking(true);
      const sha256 = await sha256Hex(file);
      setChecking(false);
      const ticket = await requestInstallerUploadAction({ fileName: file.name, size: file.size, sha256 });
      if (!ticket.success) {
        toast.error(ticket.message);
        return;
      }
      try {
        await put(ticket.uploadUrl, ticket.contentType, file);
      } catch {
        toast.error("Upload to storage failed. Check the bucket's CORS settings allow this site.");
        return;
      }
      const result = await confirmInstallerUploadAction({ key: ticket.key, fileName: file.name, sha256 });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success("Installer uploaded. The team can download it from this page.");
      router.refresh();
    } finally {
      setChecking(false);
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Desktop app installer</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Upload the Windows installer (<span className="font-mono">Priinteve-Companion-Setup-x.y.z.exe</span>; keep this name, since it carries the version. Built with{" "}
          <span className="font-mono">npm run dist</span> in <span className="font-mono">companion/</span>). Everyone with
          Companion access gets a <strong>Download for Windows</strong> button, and computers that already have the app are offered the update automatically. Uploading a newer one replaces the old.
        </p>
      </div>
      <p className="mb-3 text-sm">
        {current ? (
          <>
            Current: <span className="font-medium">{current.fileName}</span>
            {current.version ? ` (version ${current.version})` : ""}
            {current.size ? ` · ${(current.size / (1024 * 1024)).toFixed(1)} MB` : ""}
            {current.uploadedAt ? ` · uploaded ${formatDateTime(current.uploadedAt)}` : ""}
          </>
        ) : (
          <span className="text-muted-foreground">No installer uploaded yet.</span>
        )}
      </p>
      {storageConfigured ? (
        <>
          <input ref={input} type="file" accept=".exe" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" disabled={progress !== null} onClick={() => input.current?.click()}>
            <Upload className="size-4" />
            {checking ? "Checking file…" : progress !== null ? `Uploading… ${progress}%` : current ? "Replace installer" : "Upload installer"}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">File storage isn&apos;t configured on the server (AWS_S3_BUCKET, AWS_REGION and the AWS access keys).</p>
      )}
    </div>
  );
}
