import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type _Object,
} from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * Upload a buffer to R2 and return the public URL.
 * Retries up to 3 times on transient failures so a brief R2 hiccup
 * doesn't fail the clip after all the expensive download+encode work.
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
  attempt = 1
): Promise<string> {
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    if (attempt >= 3) throw err;
    const delay = attempt * 2000;
    console.warn(`[r2] Upload attempt ${attempt} failed, retrying in ${delay}ms:`, err instanceof Error ? err.message : err);
    await new Promise((r) => setTimeout(r, delay));
    return uploadToR2(key, buffer, contentType, attempt + 1);
  }
}

/**
 * List every R2 object whose key starts with `prefix`. Pages internally so
 * the caller gets the full list without thinking about ContinuationToken.
 *
 * Used by the orphan-cleanup cron to enumerate per-user files. Each clip
 * stores objects under `<userId>/...` so callers pass the userId as prefix.
 */
export async function listR2Objects(prefix: string): Promise<_Object[]> {
  const out: _Object[] = [];
  let token: string | undefined;
  do {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME!,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    if (res.Contents) out.push(...res.Contents);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/**
 * Bulk-delete R2 keys. R2's DeleteObjects accepts up to 1000 keys per call,
 * so we batch in chunks of 500 to stay well under that and to keep memory
 * usage reasonable. Returns the count of successfully deleted keys.
 */
export async function deleteR2Objects(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const res = await r2.send(
      new DeleteObjectsCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      })
    );
    // With Quiet=true, only errors come back. Treat absence of an Errors
    // entry per key as a successful delete.
    const errored = res.Errors?.length ?? 0;
    deleted += chunk.length - errored;
    if (res.Errors?.length) {
      console.warn(`[r2] DeleteObjects partial failure: ${res.Errors.length} errors`, res.Errors.slice(0, 3));
    }
  }
  return deleted;
}
