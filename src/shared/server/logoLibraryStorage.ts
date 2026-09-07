import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, relative, isAbsolute } from 'node:path';
import { get, head, put } from '@vercel/blob';
import type { LogoSourceAsset, LogoPublishedRevision, LogoProject, LogoOutputAsset } from '@/shared/domain/logo/logoLibrary';
import { decodeLogoImport, renderLogoProject } from '@/shared/server/logoLibraryRender';
import { LogoLibraryError } from '@/shared/server/logoLibraryOperations';

export const LOGO_SOURCE_MAX_BYTES = 3 * 1024 * 1024;
export const LOGO_STORED_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const LOGO_OUTPUT_MAX_BYTES = 24 * 1024 * 1024;
const mimeExtensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' } as const;
const sourcePathPattern = /^logo-library\/sources\/[a-f0-9-]{36}\.(png|jpg|webp|svg)$/u;
const outputPathPattern = /^logo-library\/published\/[a-f0-9-]{36}\/logo(?:@2x)?\.(png|svg)$/u;
export function isLocalLogoStorage(): boolean {
  if (process.env.E2E_MODE !== '1') return false;
  if (process.env.VERCEL === '1' || process.env.E2E_LOCAL_PRIVATE_BLOB !== '1') throw new Error('Local logo storage is not permitted in this environment.');
  return true;
}
function localPath(pathname: string): string {
  if (!sourcePathPattern.test(pathname) && !outputPathPattern.test(pathname)) throw new LogoLibraryError('Pot logotipa ni veljavna.');
  const namespace = process.env.E2E_STORAGE_NAMESPACE ?? '';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/u.test(namespace)) throw new Error('Logo test storage namespace is invalid.');
  const base = resolve(tmpdir(), 'atehna-e2e-logo-library-v1', namespace);
  const target = resolve(base, pathname);
  const location = relative(base, target);
  if (!location || location.startsWith('..') || isAbsolute(location)) throw new Error('Logo storage path escaped its namespace.');
  return target;
}
function storeId(privateSource: boolean): string {
  const value = (privateSource ? process.env.ORDER_DOCUMENT_BLOB_STORE_ID : process.env.PUBLIC_MEDIA_BLOB_STORE_ID)?.trim();
  if (!value) throw new Error(privateSource ? 'Private logo source storage is not configured.' : 'Published logo storage is not configured.');
  return value;
}
async function saveBlob(pathname: string, bytes: Uint8Array, mimeType: string, privateSource: boolean): Promise<string> {
  if (!bytes.byteLength || bytes.byteLength > (privateSource ? LOGO_STORED_SOURCE_MAX_BYTES : LOGO_OUTPUT_MAX_BYTES)) {
    throw new LogoLibraryError('Datoteka logotipa je prazna ali prevelika.', 413);
  }
  if (isLocalLogoStorage()) {
    const target = localPath(pathname);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
    return privateSource ? '' : '/api/site-logo/assets/' + pathname.split('/').slice(2).join('/');
  }
  const result = await put(pathname, Buffer.from(bytes), {
    storeId: storeId(privateSource), access: privateSource ? 'private' : 'public',
    contentType: mimeType, addRandomSuffix: false, allowOverwrite: false,
    cacheControlMaxAge: 365 * 24 * 60 * 60, abortSignal: AbortSignal.timeout(30_000)
  });
  return result.url;
}
export async function readLimitedLogoStream(stream: ReadableStream<Uint8Array>, maximum: number): Promise<Buffer> {
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const entry = await reader.read(); if (entry.done) break;
      size += entry.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new LogoLibraryError('Datoteka logotipa je prevelika.', 413); }
      chunks.push(entry.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
async function readBlob(pathname: string, mimeType: string, maximum: number, privateSource: boolean, storedSize?: number): Promise<Buffer> {
  if (!(privateSource ? sourcePathPattern : outputPathPattern).test(pathname)) throw new LogoLibraryError('Pot logotipa ni veljavna.');
  if (isLocalLogoStorage()) {
    const target = localPath(pathname);
    const stats = await lstat(target);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size > maximum) throw new LogoLibraryError('Datoteka logotipa ni veljavna.');
    return readFile(target);
  }
  const options = { storeId: storeId(privateSource), abortSignal: AbortSignal.timeout(15_000) };
  const result = await get(pathname, { ...options, access: privateSource ? 'private' : 'public', useCache: true });
  if (!result || result.statusCode !== 200) throw new LogoLibraryError('Datoteka logotipa ne obstaja.', 404);
  try {
    if (result.blob.pathname !== pathname || result.blob.contentType.split(';', 1)[0] !== mimeType) {
      throw new LogoLibraryError('Vsebina datoteke logotipa se ne ujema z njenim zapisom.');
    }
    const contentLength = result.headers.get('content-length');
    if (contentLength !== null && (!/^\d+$/u.test(contentLength) || !Number.isSafeInteger(Number(contentLength)) || Number(contentLength) <= 0 || Number(contentLength) > maximum)) {
      throw new LogoLibraryError('Vsebina datoteke logotipa se ne ujema z njenim zapisom.');
    }
    // The SDK reports Content-Length (or zero); compressed bodies are decoded by fetch.
    const encoding = result.headers.get('content-encoding')?.trim().toLowerCase();
    let expectedSize = contentLength !== null && (!encoding || encoding === 'identity') ? Number(contentLength) : storedSize;
    if (expectedSize === undefined) {
      // Sources already carry their immutable byte count; only ambiguous outputs need metadata.
      const metadata = await head(pathname, options);
      if (metadata.pathname !== pathname || metadata.contentType.split(';', 1)[0] !== mimeType) {
        throw new LogoLibraryError('Vsebina datoteke logotipa se ne ujema z njenim zapisom.');
      }
      expectedSize = metadata.size;
    }
    if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > maximum) {
      throw new LogoLibraryError('Vsebina datoteke logotipa se ne ujema z njenim zapisom.');
    }
    const bytes = await readLimitedLogoStream(result.stream, maximum);
    if (bytes.byteLength !== expectedSize) throw new LogoLibraryError('Datoteka logotipa ni v celoti prenesena.');
    return bytes;
  } catch (error) {
    await result.stream.cancel().catch(() => undefined);
    throw error;
  }
}
export async function readLogoSource(asset: LogoSourceAsset): Promise<Uint8Array> {
  const bytes = await readBlob(asset.pathname, asset.mimeType, LOGO_STORED_SOURCE_MAX_BYTES, true, asset.bytes);
  if (bytes.byteLength !== asset.bytes) throw new LogoLibraryError('Izvirna datoteka logotipa se je spremenila.');
  return bytes;
}
export async function storeLogoSource(name: string, bytes: Uint8Array, mimeType: LogoSourceAsset['mimeType']): Promise<LogoSourceAsset> {
  if (!(mimeType in mimeExtensions) || bytes.byteLength > LOGO_STORED_SOURCE_MAX_BYTES || !bytes.byteLength) throw new LogoLibraryError('Izvorna slika ni veljavna ali presega 10 MB.', 413);
  const decoded = await decodeLogoImport(Buffer.from(bytes), mimeType);
  const id = randomUUID(); const pathname = 'logo-library/sources/' + id + '.' + mimeExtensions[mimeType];
  await saveBlob(pathname, bytes, mimeType, true);
  return { id, name: name.trim().slice(0, 120) || 'Slika', url: '/api/admin/logo-library/assets/' + id,
    pathname, mimeType, width: decoded.width, height: decoded.height, bytes: bytes.byteLength,
    bounds: decoded.bounds, warnings: decoded.warnings };
}
export function imageLogoProject(asset: LogoSourceAsset): LogoProject {
  return { version: 1, canvas: { width: asset.width, height: asset.height }, layers: [{
    id: randomUUID(), name: asset.name, type: 'image', assetId: asset.id,
    x: 0, y: 0, width: asset.width, height: asset.height, rotation: 0, opacity: 1, visible: true, locked: false,
    crop: { x: 0, y: 0, width: 1, height: 1 }, mask: 'rectangle'
  }] };
}
export async function createLogoPublication(project: LogoProject, assets: LogoSourceAsset[]): Promise<LogoPublishedRevision> {
  const rendered = await renderLogoProject(project, assets, readLogoSource);
  const id = randomUUID(); const prefix = 'logo-library/published/' + id + '/';
  const output = async (file: string, bytes: Uint8Array, width: number, height: number, mimeType: LogoOutputAsset['mimeType']): Promise<LogoOutputAsset> => {
    const pathname = prefix + file;
    return { pathname, url: await saveBlob(pathname, bytes, mimeType, false), width, height, mimeType };
  };
  // Publish only after every immutable output exists; failures leave the current DB pointer unchanged.
  const png = await output('logo.png', rendered.png, rendered.width, rendered.height, 'image/png');
  const metadata2x = await (await import('sharp')).default(rendered.png2x).metadata();
  const png2x = await output('logo@2x.png', rendered.png2x, metadata2x.width!, metadata2x.height!, 'image/png');
  const svg = await output('logo.svg', Buffer.from(rendered.svg), rendered.width, rendered.height, 'image/svg+xml');
  return { id, createdAt: new Date().toISOString(), project: structuredClone(project), png, png2x, svg, bounds: rendered.bounds };
}
export async function readLogoPublishedOutput(asset: LogoOutputAsset): Promise<Buffer> {
  return readBlob(asset.pathname, asset.mimeType, LOGO_OUTPUT_MAX_BYTES, false);
}
