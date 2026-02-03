import 'server-only';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

export async function uploadBlob(path: string, data: Blob | ArrayBuffer, contentType: string) {
  if (!blobToken) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  const { put } = await (0, eval)('import("@vercel/blob")');
  return put(path, data, {
    access: 'public',
    token: blobToken,
    contentType
  });
}
