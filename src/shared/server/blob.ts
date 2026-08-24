import { del, get, put } from '@vercel/blob';

type UploadResult = {
  url: string;
  pathname: string;
};

export type PrivateOrderDocumentBlob = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
};

const FORBIDDEN_PATH_CHARS = /[#?%\n\r]/g;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

const getOrderDocumentBlobStoreId = (): string => {
  const storeId = process.env.ORDER_DOCUMENT_BLOB_STORE_ID?.trim();
  if (!storeId) {
    throw new Error('ORDER_DOCUMENT_BLOB_STORE_ID is not set');
  }
  return storeId;
};

const validateUpload = (
  pathname: string,
  data: Buffer | Uint8Array,
  contentType: string
) => {
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
  if (effectiveContentType === 'application/pdf') {
    const header = payload.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error('Invalid PDF payload (missing %PDF- header). Binary likely got converted to text/base64.');
    }
  }

  return { payload, normalizedPathname, effectiveContentType };
};

export function buildOrderDocumentBlobPath(
  customerAccessId: string,
  extension: 'pdf' | 'jpg'
): string {
  const normalizedAccessId = customerAccessId.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalizedAccessId)) {
    throw new Error('Invalid order document customer access id.');
  }

  return withStorageNamespace([
    'order-documents',
    `${normalizedAccessId}.${extension}`
  ]);
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

export async function uploadPrivateOrderDocumentBlob(
  pathname: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<UploadResult> {
  refuseExternalBlobInE2e();
  const storeId = getOrderDocumentBlobStoreId();
  const { payload, normalizedPathname, effectiveContentType } = validateUpload(
    pathname,
    data,
    contentType
  );

  const blob = await put(normalizedPathname, payload, {
    access: 'private',
    addRandomSuffix: true,
    contentType: effectiveContentType,
    storeId
  });
  return { url: blob.url, pathname: blob.pathname };
}

export async function readPrivateOrderDocumentBlob(
  pathname: string
): Promise<PrivateOrderDocumentBlob | null> {
  refuseExternalBlobInE2e();
  const storeId = getOrderDocumentBlobStoreId();
  const normalizedPathname = normalizePathname(pathname);
  if (!normalizedPathname) return null;

  const result = await get(normalizedPathname, {
    access: 'private',
    storeId,
    useCache: false
  });
  if (!result || result.statusCode !== 200) return null;

  return {
    stream: result.stream,
    contentType: result.blob.contentType,
    size: result.blob.size
  };
}

export async function deletePrivateOrderDocumentBlob(pathname: string): Promise<void> {
  refuseExternalBlobInE2e();
  const storeId = getOrderDocumentBlobStoreId();
  const normalizedPathname = normalizePathname(pathname);
  if (!normalizedPathname) return;

  await del(normalizedPathname, { storeId });
}

export async function deleteBlob(pathnameOrUrl: string): Promise<void> {
  refuseExternalBlobInE2e();
  const storeId = process.env.PUBLIC_MEDIA_BLOB_STORE_ID?.trim();
  if (!storeId) throw new Error('PUBLIC_MEDIA_BLOB_STORE_ID is not set');

  await del(pathnameOrUrl, { storeId });
}
