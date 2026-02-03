import 'server-only';

import { put } from '@vercel/blob';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (!blobToken) {
  throw new Error('BLOB_READ_WRITE_TOKEN is not set');
}

export async function uploadBlob(path: string, data: Blob | ArrayBuffer, contentType: string) {
  return put(path, data, {
    access: 'public',
    token: blobToken,
    contentType
  });
}
