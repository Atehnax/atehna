import { NextResponse } from 'next/server';
import { buildCatalogItemMediaBlobPath, uploadBlob } from '@/shared/server/blob';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const URL_IMPORT_MAX_BYTES_BY_KIND = {
  image: 4 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  document: 5 * 1024 * 1024
} as const;
type MediaImportKind = keyof typeof URL_IMPORT_MAX_BYTES_BY_KIND;

const extensionMimeTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
  dwg: 'application/acad'
};

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-čšžćđ]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extensionFromFileName(fileName: string): string | null {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  return null;
}

function extensionFromMimeType(mimeType: string): string | null {
  const [type, subtype] = mimeType.toLowerCase().split(';')[0]?.split('/') ?? [];
  if (type && subtype) return subtype.replace(/[^a-z0-9]+/g, '');
  return null;
}

function extensionFromUpload(fileName: string, mimeType: string): string {
  return extensionFromFileName(fileName) ?? extensionFromMimeType(mimeType) ?? 'bin';
}

function mediaFolderForMime(mimeType: string): 'images' | 'videos' | 'documents' {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  return 'documents';
}

function mediaFolderForKind(kind: MediaImportKind): 'images' | 'videos' | 'documents' {
  if (kind === 'image') return 'images';
  if (kind === 'video') return 'videos';
  return 'documents';
}

function normalizeMediaKind(value: FormDataEntryValue | null): MediaImportKind | null {
  if (value === 'image' || value === 'video' || value === 'document') return value;
  return null;
}

function parseSourceUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

function isBlockedSourceHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  if (normalized === '::1' || normalized === '[::1]' || normalized === '0.0.0.0') return true;
  const ipv4Match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;
  const octets = ipv4Match.slice(1).map(Number);
  const [first, second] = octets;
  if (octets.some((octet) => octet < 0 || octet > 255)) return true;
  return first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254);
}

function getUrlFileName(url: URL, contentType: string) {
  const lastSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '').trim();
  if (lastSegment && /\.[a-z0-9]{2,8}$/i.test(lastSegment)) return lastSegment;
  const extension = extensionFromMimeType(contentType) ?? 'bin';
  return `remote-media.${extension}`;
}

function inferMimeType(contentTypeHeader: string | null, fileName: string) {
  const normalizedHeader = (contentTypeHeader ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalizedHeader && normalizedHeader !== 'application/octet-stream') return normalizedHeader;
  const extension = extensionFromFileName(fileName);
  return extension ? extensionMimeTypes[extension] ?? normalizedHeader : normalizedHeader;
}

function mimeMatchesKind(mimeType: string, kind: MediaImportKind) {
  if (kind === 'image') return mimeType.startsWith('image/');
  if (kind === 'video') return mimeType.startsWith('video/');
  return !mimeType.startsWith('image/') && !mimeType.startsWith('video/');
}

async function uploadFilePayload({
  itemSlugValue,
  fileName,
  mimeType,
  payload,
  mediaFolder
}: {
  itemSlugValue: string;
  fileName: string;
  mimeType: string;
  payload: Buffer;
  mediaFolder: 'images' | 'videos' | 'documents';
}) {
  const itemSlug = sanitizeSlug(itemSlugValue);
  const extension = extensionFromUpload(fileName, mimeType);
  const storageFileName = `${Date.now()}-${itemSlug}.${extension}`;
  const blob = await uploadBlob(
    buildCatalogItemMediaBlobPath(itemSlug, storageFileName, mediaFolder),
    payload,
    mimeType || 'application/octet-stream'
  );

  return NextResponse.json({
    ok: true,
    url: blob.url,
    pathname: blob.pathname,
    filename: fileName,
    mimeType: mimeType || null,
    size: payload.byteLength
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const itemSlugValue = formData.get('itemSlug');
    const sourceUrlValue = formData.get('sourceUrl');
    const requestedMediaKind = normalizeMediaKind(formData.get('mediaKind'));

    if (typeof itemSlugValue !== 'string' || !itemSlugValue.trim()) {
      return NextResponse.json({ message: 'Manjka slug artikla.' }, { status: 400 });
    }

    if (file instanceof File) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ message: 'Datoteka je prevelika.' }, { status: 400 });
      }

      return uploadFilePayload({
        itemSlugValue,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        payload: Buffer.from(await file.arrayBuffer()),
        mediaFolder: mediaFolderForMime(file.type.toLowerCase())
      });
    }

    if (typeof sourceUrlValue === 'string' && sourceUrlValue.trim()) {
      if (!requestedMediaKind) {
        return NextResponse.json({ message: 'Manjka tip medija.' }, { status: 400 });
      }

      const sourceUrl = parseSourceUrl(sourceUrlValue);
      if (!sourceUrl) {
        return NextResponse.json({ message: 'URL ni veljaven.' }, { status: 400 });
      }
      if (isBlockedSourceHost(sourceUrl.hostname)) {
        return NextResponse.json({ message: 'URL ni dovoljen.' }, { status: 400 });
      }

      const response = await fetch(sourceUrl, { redirect: 'follow' });
      if (!response.ok) {
        return NextResponse.json({ message: 'Datoteke na URL-ju ni bilo mogoče prenesti.' }, { status: 400 });
      }

      const contentLength = Number(response.headers.get('content-length') ?? 0);
      const maxBytes = URL_IMPORT_MAX_BYTES_BY_KIND[requestedMediaKind];
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        return NextResponse.json({ message: 'Datoteka je prevelika.' }, { status: 400 });
      }

      const fileName = getUrlFileName(sourceUrl, response.headers.get('content-type') ?? 'application/octet-stream');
      const mimeType = inferMimeType(response.headers.get('content-type'), fileName) || 'application/octet-stream';
      if (!mimeMatchesKind(mimeType, requestedMediaKind)) {
        return NextResponse.json({ message: 'URL ne kaže na pravilen tip medija za izbrani zavihek.' }, { status: 400 });
      }

      const payload = Buffer.from(await response.arrayBuffer());
      if (payload.byteLength > maxBytes) {
        return NextResponse.json({ message: 'Datoteka je prevelika.' }, { status: 400 });
      }

      return uploadFilePayload({
        itemSlugValue,
        fileName,
        mimeType,
        payload,
        mediaFolder: mediaFolderForKind(requestedMediaKind)
      });
    }

    return NextResponse.json({ message: 'Datoteka ali URL manjka.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri nalaganju datoteke.' },
      { status: 500 }
    );
  }
}
