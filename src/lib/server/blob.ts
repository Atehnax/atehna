import { del, put } from '@vercel/blob';

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
  const effectiveContentType = contentType || 'application/octet-stream';

  // Safety check for PDFs: must start with "%PDF-"
  if (effectiveContentType === 'application/pdf') {
    const header = payload.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error('Invalid PDF payload (missing %PDF- header). Binary likely got converted to text/base64.');
    }
  }

  const blob = await put(pathname, payload, {
    access: 'public',
    contentType: effectiveContentType,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return { url: blob.url, pathname: blob.pathname };
}

export async function deleteBlob(pathnameOrUrl: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }

  await del(pathnameOrUrl, {
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}
