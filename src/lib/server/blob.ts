import { put } from '@vercel/blob';

export type UploadResult = {
  url: string;
  pathname: string;
};

export async function uploadBlob(
  pathname: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<UploadResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }

  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);

  const blob = await put(pathname, payload, {
    access: 'public',
    contentType,
    token
  });

  if (!blob?.url || !blob?.pathname) {
    throw new Error('Blob upload failed: missing url/pathname');
  }

  return { url: blob.url, pathname: blob.pathname };
}
