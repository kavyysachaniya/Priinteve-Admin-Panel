import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// AWS S3 file storage (task attachments, the companion installer). Browsers upload and
// download directly with short-lived presigned URLs, so file bytes never pass through
// the Next.js server. The bucket's CORS must allow the panel's origin (docs/STORAGE.md).
//
// Configuration: AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
// Optional AWS_S3_KEY_PREFIX (default "admin-panel").

// Everything this panel writes lives under one prefix, so the bucket can be shared with other apps.
const KEY_PREFIX = (process.env.AWS_S3_KEY_PREFIX ?? "admin-panel").replace(/^\/+|\/+$/g, "");

/** Builds an object key under the panel's prefix, e.g. `admin-panel/tasks/<id>/<file>`. */
export function storageKey(...parts: string[]): string {
  return [KEY_PREFIX, ...parts].filter(Boolean).join("/");
}

export function isPanelKey(key: string): boolean {
  return key.startsWith(`${KEY_PREFIX}/`) && !key.includes("..");
}

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

let client: S3Client | null = null;

function config() {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  return { bucket, region, accessKeyId, secretAccessKey };
}

export function isStorageConfigured(): boolean {
  const c = config();
  return Boolean(c.bucket && c.region && c.accessKeyId && c.secretAccessKey);
}

function s3(): { client: S3Client; bucket: string } {
  const c = config();
  if (!c.bucket || !c.region || !c.accessKeyId || !c.secretAccessKey) {
    throw new Error("File storage isn't configured on the server (AWS_S3_BUCKET, AWS_REGION and the AWS access keys).");
  }
  client ??= new S3Client({
    region: c.region,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    // Browsers PUT to presigned URLs without checksum headers; only add checksums when S3 requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: c.bucket };
}

/** Presigned PUT. The browser must send exactly this Content-Type header. */
export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  const { client, bucket } = s3();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    signableHeaders: new Set(["content-type"]),
  });
}

function contentDisposition(fileName: string, inline: boolean): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Presigned GET that names the file and opens inline (images, PDF) or downloads it. */
export async function createDownloadUrl(key: string, fileName: string, options: { inline?: boolean; contentType?: string } = {}) {
  const { client, bucket } = s3();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: contentDisposition(fileName, options.inline ?? false),
      ...(options.contentType ? { ResponseContentType: options.contentType } : {}),
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}

/** Size and type of an uploaded object, or null if it doesn't exist. */
export async function headObject(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
  const { client, bucket } = s3();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    // Without s3:ListBucket, S3 answers 403 (not 404) for a missing key.
    if (status === 404 || status === 403 || (err as Error).name === "NotFound") return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = s3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Best-effort delete that never throws (used when cleaning up after records are gone). */
export async function deleteObjectQuietly(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await deleteObject(key);
  } catch (err) {
    console.warn(`[storage] Could not delete an object: ${err instanceof Error ? err.name : "unknown"}`);
  }
}

export function storageUrl(key: string): string {
  return `s3://${config().bucket}/${key}`;
}

/** Keeps letters, digits, dot, dash and underscore; collapses the rest. */
export function safeFileName(name: string, fallback = "file"): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}
