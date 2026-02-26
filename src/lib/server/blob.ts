import { del, put } from '@vercel/blob';

export type UploadResult = {
  url: string;
  pathname: string;
};

const FORBIDDEN_PATH_CHARS = /[#?%\n\r]/g;

const sanitizeBlobSegment = (value: string): string =>
  value
    .replace(FORBIDDEN_PATH_CHARS, '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const normalizePathname = (pathname: string): string => pathname.trim().replace(/^\/+/, '');

export function buildOrderBlobPath(orderId: string | number, fileName: string): string {
  const safeOrderId = sanitizeBlobSegment(String(orderId)) || 'order';
  const safeFileName = sanitizeBlobSegment(fileName).replace(/^\/+/, '');

  if (!safeFileName || safeFileName.endsWith('/')) {
    throw new Error(`Invalid blob fileName: "${safeFileName}".`);
  }

  return `orders/${safeOrderId}/${safeFileName}`;
}

export async function uploadBlob(
  pathname: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<UploadResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }

  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const normalizedPathname = normalizePathname(pathname);

  if (!normalizedPathname || normalizedPathname.endsWith('/')) {
    console.error('[blob.upload] invalid pathname (folder-like path is not allowed)', {
      pathname: normalizedPathname
    });
    throw new Error(`Invalid blob pathname: "${normalizedPathname}". Provide a filename, not a folder path.`);
  }

  const fileName = normalizedPathname.split('/').pop() ?? '';
  if (!fileName.includes('.') || fileName.endsWith('.')) {
    console.error('[blob.upload] invalid pathname (missing filename extension)', {
      pathname: normalizedPathname
    });
    throw new Error(`Invalid blob pathname: "${normalizedPathname}". Filename must include an extension.`);
  }

  const effectiveContentType = contentType || 'application/octet-stream';

  console.info('[blob.upload] put pathname', { pathname: normalizedPathname });

  // Safety check for PDFs: must start with "%PDF-"
  if (effectiveContentType === 'application/pdf') {
    const header = payload.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error('Invalid PDF payload (missing %PDF- header). Binary likely got converted to text/base64.');
    }
  }

  try {
    const blob = await put(normalizedPathname, payload, {
      access: 'public',
      contentType: effectiveContentType,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return { url: blob.url, pathname: blob.pathname };
  } catch (error) {
    console.error('[blob.upload] put failed', {
      pathname: normalizedPathname,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

export async function deleteBlob(pathnameOrUrl: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }

  await del(pathnameOrUrl, {
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}
