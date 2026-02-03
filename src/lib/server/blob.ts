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
  const blob = await put(pathname, data, {
    access: 'public',
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  return { url: blob.url, pathname: blob.pathname };
}
