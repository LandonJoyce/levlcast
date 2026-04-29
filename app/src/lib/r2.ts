import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
