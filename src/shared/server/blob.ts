import { createReadStream } from 'node:fs';
import { lstat, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
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
const E2E_STORAGE_NAMESPACE_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/u;
const E2E_PRIVATE_BLOB_PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/u;
const E2E_PRIVATE_BLOB_ROOT_NAME = 'atehna-e2e-private-order-documents-v1';
const E2E_LOCAL_PRIVATE_BLOB_FLAG = 'E2E_LOCAL_PRIVATE_BLOB';

const sanitizeBlobSegment = (value: string): string =>
  value
    .replace(FORBIDDEN_PATH_CHARS, '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const normalizePathname = (pathname: string): string => pathname.trim().replace(/^\/+/, '');

const readE2eStorageNamespace = (): string => {
  const namespace = process.env.E2E_STORAGE_NAMESPACE?.trim() ?? '';
  if (!E2E_STORAGE_NAMESPACE_PATTERN.test(namespace)) {
    throw new Error('[e2e-preflight] E2E_STORAGE_NAMESPACE is missing or invalid.');
  }
  return namespace;
};

const withStorageNamespace = (segments: string[]): string => {
  if (process.env.E2E_MODE !== '1') {
    return segments.join('/');
  }

  return [readE2eStorageNamespace(), ...segments].join('/');
};

type E2ePrivateBlobTarget = {
  absolutePath: string;
  normalizedPathname: string;
};

function resolveE2ePrivateBlobTarget(pathname: string): E2ePrivateBlobTarget {
  const namespace = readE2eStorageNamespace();
  const normalizedPathname = normalizePathname(pathname);
  const segments = normalizedPathname.split('/');
  if (
    segments[0] !== namespace ||
    segments.length < 2 ||
    segments.some((segment) => (
      !E2E_PRIVATE_BLOB_PATH_SEGMENT_PATTERN.test(segment) ||
      segment === '.' ||
      segment === '..'
    ))
  ) {
    throw new Error(
      '[e2e-preflight] Private order-document blob path must stay inside its E2E namespace.'
    );
  }

  const namespaceRoot = resolve(
    tmpdir(),
    E2E_PRIVATE_BLOB_ROOT_NAME,
    namespace
  );
  const absolutePath = resolve(namespaceRoot, ...segments.slice(1));
  const relativePath = relative(namespaceRoot, absolutePath);
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(
      '[e2e-preflight] Private order-document blob path escaped its E2E namespace.'
    );
  }

  return { absolutePath, normalizedPathname };
}

function e2ePrivateBlobContentType(pathname: string): string {
  const lowerPathname = pathname.toLowerCase();
  if (lowerPathname.endsWith('.pdf')) return 'application/pdf';
  if (lowerPathname.endsWith('.jpg')) return 'image/jpeg';
  throw new Error(
    '[e2e-preflight] Private order-document blob has an unsupported extension.'
  );
}

async function uploadE2ePrivateOrderDocumentBlob(
  pathname: string,
  payload: Buffer,
  contentType: string
): Promise<UploadResult> {
  const target = resolveE2ePrivateBlobTarget(pathname);
  if (e2ePrivateBlobContentType(target.normalizedPathname) !== contentType) {
    throw new Error(
      '[e2e-preflight] Private order-document blob extension does not match its content type.'
    );
  }

  await mkdir(dirname(target.absolutePath), { recursive: true });
  await writeFile(target.absolutePath, payload, { flag: 'wx' });
  return {
    url: `https://e2e-private-order-document.invalid/${target.normalizedPathname}`,
    pathname: target.normalizedPathname
  };
}

async function readE2ePrivateOrderDocumentBlob(
  pathname: string
): Promise<PrivateOrderDocumentBlob | null> {
  const target = resolveE2ePrivateBlobTarget(pathname);
  let fileStats;
  try {
    fileStats = await lstat(target.absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
    throw new Error(
      '[e2e-preflight] Private order-document blob target must be a regular file.'
    );
  }

  return {
    stream: Readable.toWeb(createReadStream(target.absolutePath)) as ReadableStream<Uint8Array>,
    contentType: e2ePrivateBlobContentType(target.normalizedPathname),
    size: fileStats.size
  };
}

async function deleteE2ePrivateOrderDocumentBlob(pathname: string): Promise<void> {
  const target = resolveE2ePrivateBlobTarget(pathname);
  let fileStats;
  try {
    fileStats = await lstat(target.absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
    throw new Error(
      '[e2e-preflight] Private order-document blob target must be a regular file.'
    );
  }
  await rm(target.absolutePath);

}
const refuseExternalBlobInE2e = () => {
  if (process.env.E2E_MODE === '1') {
    throw new Error(
      '[e2e-preflight] External Blob storage is disabled in E2E mode; use deterministic local media fixtures.'
    );
  }
};

const assertE2eLocalPrivateBlobEnabled = () => {
  if (process.env[E2E_LOCAL_PRIVATE_BLOB_FLAG] !== '1') {
    throw new Error(
      `[e2e-preflight] ${E2E_LOCAL_PRIVATE_BLOB_FLAG}=1 is required for local private order-document storage.`
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

export function buildQuoteDocumentBlobPath(
  customerAccessId: string,
  extension: 'pdf' | 'jpg'
): string {
  const normalizedAccessId = customerAccessId.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalizedAccessId)) {
    throw new Error('Invalid quote document customer access id.');
  }
  return withStorageNamespace([
    'quote-documents',
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
  const { payload, normalizedPathname, effectiveContentType } = validateUpload(
    pathname,
    data,
    contentType
  );
  if (process.env.E2E_MODE === '1') {
    assertE2eLocalPrivateBlobEnabled();
    return uploadE2ePrivateOrderDocumentBlob(
      normalizedPathname,
      payload,
      effectiveContentType
    );
  }
  const storeId = getOrderDocumentBlobStoreId();


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
  const normalizedPathname = normalizePathname(pathname);
  if (!normalizedPathname) return null;
  if (process.env.E2E_MODE === '1') {
    assertE2eLocalPrivateBlobEnabled();
    return readE2ePrivateOrderDocumentBlob(normalizedPathname);
  }
  const storeId = getOrderDocumentBlobStoreId();


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
  const normalizedPathname = normalizePathname(pathname);
  if (!normalizedPathname) return;
  if (process.env.E2E_MODE === '1') {
    assertE2eLocalPrivateBlobEnabled();
    await deleteE2ePrivateOrderDocumentBlob(normalizedPathname);
    return;
  }
  const storeId = getOrderDocumentBlobStoreId();


  await del(normalizedPathname, { storeId });
}

export async function deleteBlob(pathnameOrUrl: string): Promise<void> {
  refuseExternalBlobInE2e();
  const storeId = process.env.PUBLIC_MEDIA_BLOB_STORE_ID?.trim();
  if (!storeId) throw new Error('PUBLIC_MEDIA_BLOB_STORE_ID is not set');

  await del(pathnameOrUrl, { storeId });
}
