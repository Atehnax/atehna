import { del, put } from '@vercel/blob';

type UploadResult = {
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

const withStorageNamespace = (segments: string[]): string => {
  if (process.env.E2E_MODE !== '1') {
    return segments.join('/');
  }

  const rawNamespace = process.env.E2E_STORAGE_NAMESPACE?.trim() ?? '';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/u.test(rawNamespace)) {
    throw new Error('[e2e-preflight] E2E_STORAGE_NAMESPACE is missing or invalid.');
  }
  return [rawNamespace, ...segments].join('/');
};

const refuseExternalBlobInE2e = () => {
  if (process.env.E2E_MODE === '1') {
    throw new Error(
      '[e2e-preflight] External Blob storage is disabled in E2E mode; use deterministic local media fixtures.'
    );
  }
};

export function buildOrderBlobPath(orderId: string | number, fileName: string): string {
  const safeOrderId = sanitizeBlobSegment(String(orderId)) || 'order';
  const safeFileName = sanitizeBlobSegment(fileName).replace(/^\/+/, '');

  if (!safeFileName || safeFileName.endsWith('/')) {
    throw new Error(`Invalid blob fileName: "${safeFileName}".`);
  }

  return withStorageNamespace(['orders', safeOrderId, safeFileName]);
}

export function buildCatalogImageBlobPath(
  categorySlug: string,
  fileName: string,
  subcategoryPath?: string[]
): string {
  const safeCategorySlug = sanitizeBlobSegment(categorySlug) || 'category';
  const safeSegments = (subcategoryPath ?? []).map((segment) => sanitizeBlobSegment(segment)).filter(Boolean);
  const safeFileName = sanitizeBlobSegment(fileName).replace(/^\/+/, '');

  if (!safeFileName || safeFileName.endsWith('/')) {
    throw new Error(`Invalid blob fileName: "${safeFileName}".`);
  }

  return withStorageNamespace(['catalog-categories', safeCategorySlug, ...safeSegments, safeFileName]);
}

export function buildCatalogItemMediaBlobPath(itemSlug: string, fileName: string, mediaFolder: 'images' | 'videos' | 'documents'): string {
  const safeItemSlug = sanitizeBlobSegment(itemSlug) || 'artikel';
  const safeFileName = sanitizeBlobSegment(fileName).replace(/^\/+/, '');

  if (!safeFileName || safeFileName.endsWith('/')) {
    throw new Error(`Invalid blob fileName: "${safeFileName}".`);
  }

  return withStorageNamespace(['catalog-items', safeItemSlug, mediaFolder, safeFileName]);
}

export function buildLandingPageMediaBlobPath(elementId: string, fileName: string): string {
  const safeElementId = sanitizeBlobSegment(elementId) || 'element';
  const safeFileName = sanitizeBlobSegment(fileName).replace(/^\/+/, '');

  if (!safeFileName || safeFileName.endsWith('/')) {
    throw new Error(`Invalid blob fileName: "${safeFileName}".`);
  }

  return withStorageNamespace(['landing-page', safeElementId, safeFileName]);
}

export function buildSiteLogoBlobPath(masterId: string, fileName: string): string {
  const safeMasterId = sanitizeBlobSegment(masterId) || 'master';
  const safeFileName = sanitizeBlobSegment(fileName).replace(/^\/+/, '');

  if (!safeFileName || safeFileName.endsWith('/')) {
    throw new Error(`Invalid blob fileName: "${safeFileName}".`);
  }

  return withStorageNamespace(['site-logo', 'masters', safeMasterId, safeFileName]);
}

export async function uploadBlob(
  pathname: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<UploadResult> {
  refuseExternalBlobInE2e();
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
  refuseExternalBlobInE2e();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }

  await del(pathnameOrUrl, {
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}
