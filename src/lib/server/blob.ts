export type UploadResult = {
  url: string;
  pathname: string;
};

async function getBlobModule() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const moduleName = '@vercel/blob';
  return require(moduleName) as typeof import('@vercel/blob');
}

export async function uploadBlob(
  pathname: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<UploadResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  const { put } = await getBlobModule();
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const blob = await put(pathname, payload, {
    access: 'public',
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  return { url: blob.url, pathname: blob.pathname };
}
