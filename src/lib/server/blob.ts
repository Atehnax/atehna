import 'server-only';
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
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }

  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);

  const blob = await put(pathname, payload, {
    access: 'public',
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return { url: blob.url, pathname: blob.pathname };
}
