export const PUBLIC_MEDIA_UPLOAD_TOKEN_TTL_MS = 5 * 60 * 1000;
export const PUBLIC_MEDIA_CACHE_CONTROL_SECONDS = 365 * 24 * 60 * 60;

export const PUBLIC_MEDIA_UPLOAD_LIMITS = {
  catalogImage: 4 * 1024 * 1024,
  catalogVideo: 100 * 1024 * 1024,
  catalogDocument: 5 * 1024 * 1024,
  categoryImage: 5 * 1024 * 1024,
  landingImage: 5 * 1024 * 1024,
  landingVideo: 40 * 1024 * 1024,
  siteLogo: 10 * 1024 * 1024,
  emailSharedImage: 5 * 1024 * 1024
} as const;

export const PUBLIC_MEDIA_CONTENT_TYPES = {
  image: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ],
  video: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v',
    'video/x-msvideo',
    'video/x-matroska',
    'video/ogg'
  ],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/acad',
    'application/x-acad',
    'application/x-autocad',
    'image/vnd.dwg',
    'application/octet-stream'
  ],
  siteLogo: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  emailSharedImage: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
} as const;

export type CatalogPublicMediaKind = 'image' | 'video' | 'document';

export type PublicMediaUploadContext =
  | { scope: 'catalog-item'; itemSlug: string; mediaKind: CatalogPublicMediaKind }
  | { scope: 'category-image'; categorySlug: string; subcategoryPath?: string[] }
  | { scope: 'landing-media'; elementId: string; mediaKind: 'image' | 'video' }
  | { scope: 'site-logo'; masterId: string }
  | { scope: 'email-shared-image' };

export type PublicMediaUploadPayload = PublicMediaUploadContext & {
  contentType: string;
  originalFileName: string;
  uploadId: string;
};

export type PublicMediaUploadPolicy = {
  allowedContentTypes: string[];
  cacheControlMaxAge: number;
  contentType: string;
  filename: string;
  maximumSizeInBytes: number;
  mediaKind: CatalogPublicMediaKind;
  pathname: string;
  payload: PublicMediaUploadPayload;
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
  dwg: 'image/vnd.dwg'
};

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/ogg': 'ogv',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/acad': 'dwg',
  'application/x-acad': 'dwg',
  'application/x-autocad': 'dwg',
  'image/vnd.dwg': 'dwg',
  'application/octet-stream': 'bin'
};

const UPLOAD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,79}$/u;
const FORBIDDEN_PATH_CHARS = /[#?%\n\r]/g;

function sanitizeBlobSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[đð]/giu, 'd')
    .replace(FORBIDDEN_PATH_CHARS, '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeSlug(value: string, fallback: string): string {
  return sanitizeBlobSegment(value.toLowerCase()).slice(0, 120) || fallback;
}

function normalizeOriginalFileName(value: string): string {
  const fileName = value.split(/[\\/]/u).pop()?.trim() ?? '';
  if (!fileName || fileName.length > 255) {
    throw new Error('Ime datoteke ni veljavno.');
  }
  return fileName;
}

function extensionFromFileName(fileName: string): string | null {
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';
  return /^[a-z0-9]{1,12}$/u.test(extension) ? extension : null;
}

export function resolvePublicMediaContentType(fileName: string, suppliedContentType: string): string {
  const normalized = suppliedContentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalized && normalized !== 'application/octet-stream') return normalized;
  const extension = extensionFromFileName(fileName);
  return (extension ? CONTENT_TYPE_BY_EXTENSION[extension] : null) ?? (normalized || 'application/octet-stream');
}

function mediaPolicyForPayload(payload: PublicMediaUploadPayload) {
  if (payload.scope === 'catalog-item') {
    if (payload.mediaKind === 'image') {
      return {
        allowedContentTypes: [...PUBLIC_MEDIA_CONTENT_TYPES.image],
        maximumSizeInBytes: PUBLIC_MEDIA_UPLOAD_LIMITS.catalogImage,
        mediaFolder: 'images' as const,
        mediaKind: 'image' as const
      };
    }
    if (payload.mediaKind === 'video') {
      return {
        allowedContentTypes: [...PUBLIC_MEDIA_CONTENT_TYPES.video],
        maximumSizeInBytes: PUBLIC_MEDIA_UPLOAD_LIMITS.catalogVideo,
        mediaFolder: 'videos' as const,
        mediaKind: 'video' as const
      };
    }
    if (payload.mediaKind === 'document') {
      return {
        allowedContentTypes: [...PUBLIC_MEDIA_CONTENT_TYPES.document],
        maximumSizeInBytes: PUBLIC_MEDIA_UPLOAD_LIMITS.catalogDocument,
        mediaFolder: 'documents' as const,
        mediaKind: 'document' as const
      };
    }
  }

  if (payload.scope === 'category-image') {
    return {
      allowedContentTypes: [...PUBLIC_MEDIA_CONTENT_TYPES.image],
      maximumSizeInBytes: PUBLIC_MEDIA_UPLOAD_LIMITS.categoryImage,
      mediaFolder: 'images' as const,
      mediaKind: 'image' as const
    };
  }

  if (payload.scope === 'landing-media') {
    if (payload.mediaKind === 'image') {
      return {
        allowedContentTypes: [...PUBLIC_MEDIA_CONTENT_TYPES.image],
        maximumSizeInBytes: PUBLIC_MEDIA_UPLOAD_LIMITS.landingImage,
        mediaFolder: 'images' as const,
        mediaKind: 'image' as const
      };
    }
    if (payload.mediaKind === 'video') {
      return {
        allowedContentTypes: [...PUBLIC_MEDIA_CONTENT_TYPES.video],
        maximumSizeInBytes: PUBLIC_MEDIA_UPLOAD_LIMITS.landingVideo,
        mediaFolder: 'videos' as const,
        mediaKind: 'video' as const
      };
    }
  }

  if (payload.scope === 'site-logo') {
    return {
      allowedContentTypes: [...PUBLIC_MEDIA_CONTENT_TYPES.siteLogo],
      maximumSizeInBytes: PUBLIC_MEDIA_UPLOAD_LIMITS.siteLogo,
      mediaFolder: 'images' as const,
      mediaKind: 'image' as const
    };
  }

  if (payload.scope === 'email-shared-image') {
    return {
      allowedContentTypes: [...PUBLIC_MEDIA_CONTENT_TYPES.emailSharedImage],
      maximumSizeInBytes: PUBLIC_MEDIA_UPLOAD_LIMITS.emailSharedImage,
      mediaFolder: 'images' as const,
      mediaKind: 'image' as const
    };
  }

  throw new Error('Vrsta nalaganja medija ni veljavna.');
}

function parseString(value: unknown, label: string, maximumLength = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximumLength) {
    throw new Error(`${label} ni veljaven.`);
  }
  return value.trim();
}

export function parsePublicMediaUploadPayload(
  clientPayload: string | null,
  expectedScope?: PublicMediaUploadContext['scope']
): PublicMediaUploadPayload {
  if (!clientPayload || clientPayload.length > 4096) {
    throw new Error('Podatki za nalaganje medija manjkajo.');
  }

  let value: unknown;
  try {
    value = JSON.parse(clientPayload);
  } catch {
    throw new Error('Podatki za nalaganje medija niso veljavni.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Podatki za nalaganje medija niso veljavni.');
  }
  const record = value as Record<string, unknown>;
  const scope = parseString(record.scope, 'Namen nalaganja', 40) as PublicMediaUploadContext['scope'];
  if (expectedScope && scope !== expectedScope) {
    throw new Error('Namen nalaganja medija se ne ujema z izbranim mestom.');
  }
  const uploadId = parseString(record.uploadId, 'ID nalaganja', 80).toLowerCase();
  if (!UPLOAD_ID_PATTERN.test(uploadId)) throw new Error('ID nalaganja ni veljaven.');
  const originalFileName = normalizeOriginalFileName(parseString(record.originalFileName, 'Ime datoteke', 255));
  const contentType = resolvePublicMediaContentType(
    originalFileName,
    parseString(record.contentType, 'Vrsta datoteke', 160)
  );

  if (scope === 'catalog-item') {
    const mediaKind = parseString(record.mediaKind, 'Vrsta medija', 20);
    if (mediaKind !== 'image' && mediaKind !== 'video' && mediaKind !== 'document') {
      throw new Error('Vrsta medija ni veljavna.');
    }
    return {
      scope,
      itemSlug: parseString(record.itemSlug, 'Slug artikla'),
      mediaKind,
      uploadId,
      originalFileName,
      contentType
    };
  }

  if (scope === 'category-image') {
    const rawPath = record.subcategoryPath;
    if (rawPath !== undefined && (!Array.isArray(rawPath) || rawPath.length > 12)) {
      throw new Error('Pot podkategorije ni veljavna.');
    }
    const subcategoryPath = (rawPath ?? []).map((segment) => parseString(segment, 'Del poti podkategorije'));
    return {
      scope,
      categorySlug: parseString(record.categorySlug, 'Kategorija'),
      ...(subcategoryPath.length > 0 ? { subcategoryPath } : {}),
      uploadId,
      originalFileName,
      contentType
    };
  }

  if (scope === 'landing-media') {
    const mediaKind = parseString(record.mediaKind, 'Vrsta medija', 20);
    if (mediaKind !== 'image' && mediaKind !== 'video') throw new Error('Vrsta medija ni veljavna.');
    return {
      scope,
      elementId: parseString(record.elementId, 'Element pristajalne strani'),
      mediaKind,
      uploadId,
      originalFileName,
      contentType
    };
  }

  if (scope === 'site-logo') {
    const masterId = parseString(record.masterId, 'ID glavne različice', 80);
    if (!/^[a-zA-Z0-9._-]{1,80}$/u.test(masterId)) {
      throw new Error('ID glavne različice ni veljaven.');
    }
    return {
      scope,
      masterId,
      uploadId,
      originalFileName,
      contentType
    };
  }

  if (scope === 'email-shared-image') {
    return {
      scope,
      uploadId,
      originalFileName,
      contentType
    };
  }

  throw new Error('Namen nalaganja medija ni veljaven.');
}

export type MediaUploadPromiseCache<TFile extends object, TResult> = WeakMap<
  TFile,
  Map<string, Promise<TResult>>
>;

/**
 * Reuses a completed or in-flight upload while the same File remains staged.
 * Failed requests are evicted so a retry can make a fresh request.
 */
export function getOrCreateCachedMediaUpload<TFile extends object, TResult>(
  cache: MediaUploadPromiseCache<TFile, TResult>,
  file: TFile,
  cacheKey: string,
  upload: () => Promise<TResult>
): Promise<TResult> {
  let uploadsForFile = cache.get(file);
  if (!uploadsForFile) {
    uploadsForFile = new Map();
    cache.set(file, uploadsForFile);
  }

  const existingUpload = uploadsForFile.get(cacheKey);
  if (existingUpload) return existingUpload;

  const pendingUpload = Promise.resolve().then(upload);
  uploadsForFile.set(cacheKey, pendingUpload);
  void pendingUpload.catch(() => {
    if (uploadsForFile?.get(cacheKey) !== pendingUpload) return;
    uploadsForFile.delete(cacheKey);
    if (uploadsForFile.size === 0) cache.delete(file);
  });
  return pendingUpload;
}

export function getPublicMediaUploadPolicy(payload: PublicMediaUploadPayload): PublicMediaUploadPolicy {
  const normalizedPayload = parsePublicMediaUploadPayload(JSON.stringify(payload), payload.scope);
  const mediaPolicy = mediaPolicyForPayload(normalizedPayload);
  if (!(mediaPolicy.allowedContentTypes as readonly string[]).includes(normalizedPayload.contentType)) {
    throw new Error('Vrsta datoteke ni dovoljena za izbrano mesto.');
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[normalizedPayload.contentType];
  if (!extension) throw new Error('Končnice za izbrano vrsto datoteke ni mogoče določiti.');
  const baseName = sanitizeBlobSegment(normalizedPayload.originalFileName.replace(/\.[^.]+$/u, '')).slice(0, 80) || 'media';
  const storedFileName = `${normalizedPayload.uploadId}-${baseName}.${extension}`;

  let pathname: string;
  if (normalizedPayload.scope === 'catalog-item') {
    pathname = [
      'catalog-items',
      sanitizeSlug(normalizedPayload.itemSlug, 'artikel'),
      mediaPolicy.mediaFolder,
      storedFileName
    ].join('/');
  } else if (normalizedPayload.scope === 'category-image') {
    pathname = [
      'catalog-categories',
      sanitizeSlug(normalizedPayload.categorySlug, 'category'),
      ...(normalizedPayload.subcategoryPath ?? []).map((segment) => sanitizeSlug(segment, 'subcategory')),
      storedFileName
    ].join('/');
  } else if (normalizedPayload.scope === 'landing-media') {
    pathname = [
      'landing-page',
      sanitizeSlug(normalizedPayload.elementId, 'element'),
      storedFileName
    ].join('/');
  } else if (normalizedPayload.scope === 'site-logo') {
    pathname = [
      'site-logo',
      'masters',
      sanitizeSlug(normalizedPayload.masterId, 'master'),
      storedFileName
    ].join('/');
  } else {
    pathname = ['email', 'shared', storedFileName].join('/');
  }

  return {
    allowedContentTypes: mediaPolicy.allowedContentTypes,
    cacheControlMaxAge: PUBLIC_MEDIA_CACHE_CONTROL_SECONDS,
    contentType: normalizedPayload.contentType,
    filename: normalizedPayload.originalFileName,
    maximumSizeInBytes: mediaPolicy.maximumSizeInBytes,
    mediaKind: mediaPolicy.mediaKind,
    pathname,
    payload: normalizedPayload
  };
}

export function createPublicMediaUploadPayload(
  context: PublicMediaUploadContext,
  file: Pick<File, 'name' | 'type'>,
  uploadId: string
): PublicMediaUploadPayload {
  return parsePublicMediaUploadPayload(JSON.stringify({
    ...context,
    originalFileName: file.name,
    contentType: resolvePublicMediaContentType(file.name, file.type),
    uploadId
  }), context.scope);
}
