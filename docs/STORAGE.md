# File storage (AWS S3)

The panel stores files in one AWS S3 bucket:
- **task attachments** (images, PDF, DOC/DOCX and XML on the task page);
- **the Windows installer** for the desktop companion ([COMPANION.md](./COMPANION.md)).

Files never pass through the Next.js server. The browser uploads straight to S3 with a short-lived **presigned PUT** URL, and downloads go through a permission-checked route that redirects to a 5-minute **presigned GET** URL. The bucket stays private.

**Code:**
- `lib/services/storage.ts`: client, presigned URLs, HEAD and delete, key prefix.
- `lib/services/attachments.ts`, `lib/actions/attachments.ts`, `lib/validations/attachments.ts`.
- `components/tasks/task-attachments.tsx`.
- `app/api/attachments/[id]/route.ts`.
- `lib/services/companion/installer.ts`, `app/api/companion/installer/route.ts`.

## Environment variables

| Variable | Value |
|---|---|
| `S3_BUCKET` (or `AWS_S3_BUCKET`) | Bucket name |
| `S3_REGION` | Bucket region, e.g. `ap-south-1` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | An IAM user's access key |
| `S3_KEY_PREFIX` | Optional; default `admin-panel`. Every object this panel writes is under `<prefix>/`, so the bucket can be shared with other apps. |

The standard `AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` names are also read as a fallback, which is handy locally. **On Vercel, use the `S3_*` names**: Vercel reserves the `AWS_*` names for its own runtime.

Storage features switch on only when the bucket, region and both keys are set. Otherwise the task page and Companion page say "File storage isn't configured".

## Bucket setup

1. **Keep the bucket private:** **Block all public access** on, no bucket policy granting public reads.
2. **CORS:** under **Permissions → Cross-origin resource sharing (CORS)**, allow the panel's origin to `PUT` (upload) and `GET`. Without this, browser uploads fail with a CORS error; the UI shows "upload to storage failed".

   The Companion page's **Setup guide → Server setup → File storage** shows this JSON with the live origin filled in.

   ```json
   [
     {
       "AllowedOrigins": ["https://priinteve-admin-panel.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

3. **IAM permissions:** the access key's user needs full access to the bucket.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": "s3:*", "Resource": ["arn:aws:s3:::BUCKET", "arn:aws:s3:::BUCKET/*"] }
     ]
   }
   ```

   The minimum the code uses is `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on `BUCKET/admin-panel/*`, plus `s3:ListBucket` on the bucket. Without `ListBucket`, S3 answers 403 instead of 404 for a missing object; the code handles both. Without `DeleteObject`, removing a file deletes its record but leaves the object in S3; the panel logs a warning.

## Task attachments

| Rule | Detail |
|---|---|
| Types | PNG, JPEG, WebP, GIF, PDF, DOC, DOCX, XML. The extension and the browser-reported type must match (an empty or generic type falls back to the extension). SVG and HTML are refused because they can carry scripts. |
| Size | Up to 25 MB per file |
| Who can see and download | Anyone who can see the task (`getTaskDetail(taskId, user)`), checked in `/api/attachments/[id]` on every download |
| Who can add | Users with `tasks:edit` who can see the task; clients only on tasks they created |
| Who can remove | Admins, or the person who added the file |
| Opening | Images and PDFs open in the browser; other types download. The file name is preserved. |
| Deleting a task | `deleteTask()` removes the task's attachment records in the same transaction, then deletes the objects (best effort) |
| Keys | `admin-panel/tasks/<taskId>/<uuid>/<sanitised file name>` |

**Upload flow:**
1. `requestTaskAttachmentUploadAction` checks the permission, the task access and the type and size, then returns a presigned PUT signed for that exact `Content-Type`.
2. The browser PUTs the file to S3.
3. `confirmTaskAttachmentAction` checks the key belongs to that task, HEADs the object to verify its real size and type, and creates the `Attachment` row. An object that fails the checks is deleted.

## Companion installer

An admin (`companion:manage`) uploads the `.exe` under **Desktop app installer** on the Companion page. The limit is 500 MB, and the page shows upload progress. The key is `admin-panel/companion/installer/<uuid>/<file name>`.

Uploading a new installer replaces the record and deletes the previous object. Everyone with `companion:use` gets a **Download for Windows** button (`/api/companion/installer`).

## Known limitations

- **Orphaned uploads:** an upload that is started but never confirmed leaves an unreferenced object. Add an S3 lifecycle rule to expire them if this matters.
- **Unscoped task page:** the task detail page itself loads tasks without user scoping ([AUTHORIZATION.md](./AUTHORIZATION.md#other-security-notes)), so attachment **names** can show there. Downloads are always checked.
