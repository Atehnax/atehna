import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { get } from '@vercel/blob';
import sharp from 'sharp';
import type { CatalogItemMediaPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import { assertCatalogImageDimensions } from '@/shared/domain/media/catalogImageQuality';
import { PUBLIC_MEDIA_UPLOAD_LIMITS } from '@/shared/domain/media/publicMediaUpload';

const rasterMimeTypes: Record<string, string> = {
  jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif',
  heif: 'image/avif', tiff: 'image/tiff', gif: 'image/gif'
};

export class CatalogImageQualityError extends Error {
  readonly statusCode = 400;
}

/** Decode the original bytes, never client-supplied dimensions or filename claims. */
export async function validateCatalogImageBytes(bytes: Buffer, declaredMimeType?: string | null) {
  if (!bytes.length || bytes.length > PUBLIC_MEDIA_UPLOAD_LIMITS.catalogImage) {
    throw new CatalogImageQualityError('Slika je prazna ali presega dovoljeno velikost 20 MB.');
  }
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 80_000_000 });
    const metadata = await image.metadata();
    const mimeType = metadata.format ? rasterMimeTypes[metadata.format] : undefined;
    if (!mimeType || (metadata.format === 'heif' && metadata.compression !== 'av1')) {
      throw new Error('Uporabite izvirno rastrsko fotografijo v obliki JPEG, PNG, WebP, AVIF, TIFF ali GIF.');
    }
    if ((metadata.pages ?? 1) !== 1) throw new Error('Uporabite eno statično fotografijo, brez animacije ali več strani.');
    if (declaredMimeType && declaredMimeType.split(';', 1)[0].trim().toLowerCase() !== mimeType) {
      throw new Error('Vsebina slike se ne ujema z navedeno vrsto datoteke.');
    }
    const rotated = metadata.orientation && metadata.orientation >= 5;
    const width = (rotated ? metadata.height : metadata.width) ?? 0;
    const height = (rotated ? metadata.width : metadata.height) ?? 0;
    assertCatalogImageDimensions(width, height);
    // metadata() only reads headers. Force full decoding to reject corrupt/truncated originals.
    await image.stats();
    return { width, height, mimeType };
  } catch (error) {
    throw new CatalogImageQualityError(error instanceof Error ? error.message : 'Slike ni mogoče prebrati.');
  }
}

export async function readLimitedCatalogImageStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > PUBLIC_MEDIA_UPLOAD_LIMITS.catalogImage) {
        await reader.cancel();
        throw new CatalogImageQualityError('Slika presega dovoljeno velikost 20 MB.');
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export function catalogImageBlobPath(urlValue: string, pathname?: string | null): string {
  let url: URL;
  try { url = new URL(urlValue); } catch { throw new CatalogImageQualityError('Novo sliko najprej naložite ali uvozite v medije artikla.'); }
  const storeId = process.env.PUBLIC_MEDIA_BLOB_STORE_ID?.trim().replace(/^store_/, '');
  const expectedHost = storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
  let resolvedPath: string;
  try { resolvedPath = decodeURIComponent(url.pathname.slice(1)); } catch { throw new CatalogImageQualityError('Pot slike ni veljavna.'); }
  if (!expectedHost || url.protocol !== 'https:' || url.hostname !== expectedHost || url.port || url.username || url.password || url.search || url.hash
    || !/^catalog-items\/[^/]+\/images\/[^/]+$/u.test(resolvedPath)
    || resolvedPath.split('/').some((part) => part === '.' || part === '..' || /[\\\r\n]/u.test(part))
    || (pathname && pathname !== resolvedPath)) {
    throw new CatalogImageQualityError('Novo sliko najprej naložite ali uvozite v medije artikla; pot in URL se morata ujemati.');
  }
  return resolvedPath;
}

export function normalizeCatalogPublicImagePath(value: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { throw new CatalogImageQualityError('Pot slike ni veljavna.'); }
  if (!decoded.startsWith('/images/') || /[?#%\\\r\n]/u.test(decoded) || decoded.slice(1).split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new CatalogImageQualityError('Pot slike mora ostati v javni knjižnici slik.');
  }
  return decoded;
}

export function catalogPublicImageUrl(value: string, environment: NodeJS.ProcessEnv = process.env): URL {
  const configured = environment.NEXT_PUBLIC_SITE_URL || environment.ADMIN_AUTH_URL
    || (environment.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + environment.VERCEL_PROJECT_PRODUCTION_URL : undefined)
    || (environment.VERCEL_URL ? 'https://' + environment.VERCEL_URL : undefined);
  if (!configured) throw new CatalogImageQualityError('Izvor javnih slik ni nastavljen.');
  const origin = new URL(configured);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port) throw new CatalogImageQualityError('Izvor javnih slik ni veljaven.');
  return new URL(normalizeCatalogPublicImagePath(value), origin.origin);
}

export async function validateStoredCatalogImage(url: string, pathname?: string | null, mimeType?: string | null) {
  if (url.startsWith('/images/')) {
    const decoded = normalizeCatalogPublicImagePath(url);
    // Vercel serves public assets from its CDN; never package the catalog into server functions.
    if (process.env.VERCEL === '1') {
      const response = await fetch(catalogPublicImageUrl(decoded), {
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok || !response.body) throw new CatalogImageQualityError('Izvirne javne slike ni mogoče preveriti. Poskusite znova.');
      const bytes = await readLimitedCatalogImageStream(response.body);
      return validateCatalogImageBytes(bytes, mimeType || response.headers.get('content-type'));
    }
    const root = resolve(process.cwd(), 'public', 'images');
    const target = resolve(root, decoded.slice('/images/'.length));
    const location = relative(root, target);
    if (!location || isAbsolute(location) || location === '..' || location.startsWith('..' + sep) || /[?#\\\r\n]/u.test(decoded)) {
      throw new CatalogImageQualityError('Pot slike mora ostati v javni knjižnici slik.');
    }
    const [stats, actualPath, actualRoot] = await Promise.all([lstat(target), realpath(target), realpath(root)]);
    const actualLocation = relative(actualRoot, actualPath);
    if (!stats.isFile() || stats.isSymbolicLink() || isAbsolute(actualLocation) || actualLocation === '..' || actualLocation.startsWith('..' + sep)
      || stats.size > PUBLIC_MEDIA_UPLOAD_LIMITS.catalogImage) {
      throw new CatalogImageQualityError('Izvirna datoteka slike ni veljavna.');
    }
    return validateCatalogImageBytes(await readFile(target), mimeType);
  }
  const verifiedPath = catalogImageBlobPath(url, pathname);
  const result = await get(verifiedPath, {
    storeId: process.env.PUBLIC_MEDIA_BLOB_STORE_ID!.trim(), access: 'public',
    useCache: false, abortSignal: AbortSignal.timeout(20_000)
  });
  if (!result || result.statusCode !== 200) throw new CatalogImageQualityError('Naložene slike ni mogoče preveriti. Poskusite znova.');
  if (result.blob.pathname !== verifiedPath) {
    await result.stream.cancel();
    throw new CatalogImageQualityError('Shranjena slika se ne ujema z izbrano potjo.');
  }
  const bytes = await readLimitedCatalogImageStream(result.stream);
  return validateCatalogImageBytes(bytes, mimeType || result.blob.contentType);
}

const value = (entry: unknown) => typeof entry === 'string' ? entry.trim() : '';

/** Old associations remain editable/removable. A changed URL is new even if its ID/path is reused. */
export function isRetainedCatalogImage(media: CatalogItemMediaPayload, existing: Array<Record<string, unknown>>): boolean {
  return existing.some((entry) => entry.media_kind === 'image'
    && entry.source_kind === media.sourceKind
    && (!Boolean(entry.hidden) || Boolean(media.hidden))
    && value(entry.blob_url) === value(media.blobUrl)
    && value(entry.blob_pathname) === value(media.blobPathname)
    && value(entry.external_url) === value(media.externalUrl));
}

export async function validateNewCatalogImages(
  media: CatalogItemMediaPayload[],
  existing: Array<Record<string, unknown>>,
  validate = validateStoredCatalogImage
): Promise<void> {
  for (const image of media) {
    if (image.mediaKind !== 'image' || isRetainedCatalogImage(image, existing)) continue;
    if (image.sourceKind !== 'upload' || image.externalUrl || !image.blobUrl) {
      throw new CatalogImageQualityError('Novo sliko najprej naložite ali uvozite v medije artikla.');
    }
    const checked = await validate(image.blobUrl, image.blobPathname, image.mimeType);
    image.imageDimensions = { width: checked.width, height: checked.height };
    image.mimeType = checked.mimeType;
  }
}
