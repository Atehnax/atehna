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

const { put } = await import('@vercel/blob');

const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
const copy = new Uint8Array(bytes);
const body = new Blob([copy.buffer], { type: contentType });

const blob = await put(pathname, body, {
  access: 'public',
  contentType,
  token: process.env.BLOB_READ_WRITE_TOKEN
});

  return { url: blob.url, pathname: blob.pathname };
}
