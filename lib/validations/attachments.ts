import { z } from "zod";

// File types allowed as task attachments. The extension and the browser-reported type must
// both match; SVG and HTML are deliberately excluded (they can carry scripts).

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export const ATTACHMENT_TYPES: Record<string, { extensions: string[]; inline: boolean; label: string }> = {
  "image/png": { extensions: ["png"], inline: true, label: "PNG image" },
  "image/jpeg": { extensions: ["jpg", "jpeg"], inline: true, label: "JPEG image" },
  "image/webp": { extensions: ["webp"], inline: true, label: "WebP image" },
  "image/gif": { extensions: ["gif"], inline: true, label: "GIF image" },
  "application/pdf": { extensions: ["pdf"], inline: true, label: "PDF" },
  "application/msword": { extensions: ["doc"], inline: false, label: "Word document" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: ["docx"],
    inline: false,
    label: "Word document",
  },
  "application/xml": { extensions: ["xml"], inline: false, label: "XML file" },
  "text/xml": { extensions: ["xml"], inline: false, label: "XML file" },
};

/** The `accept` attribute for file inputs. */
export const ATTACHMENT_ACCEPT = [
  ...Object.keys(ATTACHMENT_TYPES),
  ...new Set(Object.values(ATTACHMENT_TYPES).flatMap((t) => t.extensions.map((e) => `.${e}`))),
].join(",");

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

/** Resolves the MIME type to store, using the extension when the browser reports none (common for .xml / .doc on Windows). */
export function resolveAttachmentType(fileName: string, reportedType: string): string | null {
  const ext = extensionOf(fileName);
  const reported = reportedType.toLowerCase().split(";")[0].trim();
  if (reported && ATTACHMENT_TYPES[reported]?.extensions.includes(ext)) return reported;
  if (!reported || reported === "application/octet-stream") {
    const match = Object.entries(ATTACHMENT_TYPES).find(([, t]) => t.extensions.includes(ext));
    return match?.[0] ?? null;
  }
  return null;
}

export const attachmentUploadRequestSchema = z.object({
  taskId: z.string().trim().min(1).max(40),
  fileName: z.string().trim().min(1, "Choose a file").max(200),
  mimeType: z.string().trim().max(150),
  size: z
    .number()
    .int()
    .positive("The file is empty")
    .max(ATTACHMENT_MAX_BYTES, "Files must be 25 MB or smaller"),
});

export const attachmentConfirmSchema = z.object({
  taskId: z.string().trim().min(1).max(40),
  key: z.string().trim().min(1).max(400),
  fileName: z.string().trim().min(1).max(200),
});
