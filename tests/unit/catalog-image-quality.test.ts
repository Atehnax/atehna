import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { validateCatalogImageBytes, validateNewCatalogImages, validateStoredCatalogImage, catalogImageBlobPath, isRetainedCatalogImage, readLimitedCatalogImageStream } from '../../src/shared/server/catalogImageQuality';
import { getNativeCatalogCropSize } from '../../src/admin/features/artikli/lib/catalogImageCrop';
import type { CatalogItemMediaPayload } from '../../src/shared/domain/catalog/catalogAdminTypes';

const raster = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#475569' } }).png().toBuffer();

test('original bytes must have at least 1024 pixels in each dimension without resampling', async () => {
  for (const [width, height] of [[1023, 2048], [2048, 1023], [20, 20]]) {
    await assert.rejects(validateCatalogImageBytes(await raster(width, height), 'image/png'), /najmanj 1024/u);
  }
  const bytes = await raster(1536, 1024);
  const unchanged = Buffer.from(bytes);
  assert.deepEqual(await validateCatalogImageBytes(bytes, 'image/png'), { width: 1536, height: 1024, mimeType: 'image/png' });
  assert.deepEqual(bytes, unchanged, 'validation leaves the original byte-for-byte unchanged');
});

test('headers or mime claims cannot disguise corrupt, vector, or wrong-format product images', async () => {
  const bytes = await raster(1024, 1024);
  await assert.rejects(validateCatalogImageBytes(bytes, 'image/jpeg'), /ne ujema/u);
  await assert.rejects(validateCatalogImageBytes(bytes.subarray(0, bytes.length - 60), 'image/png'));
  await assert.rejects(validateCatalogImageBytes(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048"><rect width="2048" height="2048"/></svg>'), 'image/svg+xml'), /rastrsko/u);
  await assert.rejects(validateCatalogImageBytes(Buffer.from('not a photograph'), 'image/png'));
});

test('EXIF orientation records display dimensions without mutating the original', async () => {
  const bytes = await sharp(await raster(1536, 1024)).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  assert.deepEqual(await validateCatalogImageBytes(bytes, 'image/jpeg'), { width: 1024, height: 1536, mimeType: 'image/jpeg' });
});

test('new associations validate actual storage and replace forged client dimensions; legacy removals remain allowed', async () => {
  const existing = [{ id: 1, media_kind: 'image', source_kind: 'upload', hidden: false, blob_url: '/images/legacy.png', blob_pathname: null, external_url: null }];
  const old: CatalogItemMediaPayload = { id: 1, mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/images/legacy.png' };
  const calls: string[] = [];
  const validate = async (url: string) => { calls.push(url); return { width: 1800, height: 1200, mimeType: 'image/png' }; };
  await validateNewCatalogImages([old], existing, validate);
  await validateNewCatalogImages([], existing, validate);
  assert.deepEqual(calls, []);
  await assert.rejects(validateNewCatalogImages([old], [{ ...existing[0], hidden: true }], async () => { throw new Error('unhide invalid image'); }), /unhide invalid/u);
  await validateNewCatalogImages([{ ...old, hidden: true }], [{ ...existing[0], hidden: true }], validate);
  assert.equal(isRetainedCatalogImage({ ...old, sourceKind: 'youtube' }, existing), false);
  const added: CatalogItemMediaPayload = { ...old, blobUrl: '/images/new.png', imageDimensions: { width: 9000, height: 9000 } };
  assert.equal(isRetainedCatalogImage(added, existing), false);
  await validateNewCatalogImages([added], existing, validate);
  assert.deepEqual(calls, ['/images/new.png']);
  assert.deepEqual(added.imageDimensions, { width: 1800, height: 1200 });
  await assert.rejects(validateNewCatalogImages([{ ...added, externalUrl: 'https://example.com/fake.png' }], existing, validate), /najprej naložite/u);
  await assert.rejects(validateNewCatalogImages([added], existing, async () => { throw new Error('too small'); }), /too small/u);
});

test('saved URL and pathname must refer to the configured public blob store', () => {
  const previous = process.env.PUBLIC_MEDIA_BLOB_STORE_ID;
  process.env.PUBLIC_MEDIA_BLOB_STORE_ID = 'store_qualitytest';
  try {
    const pathname = 'catalog-items/item/images/original.png';
    assert.equal(catalogImageBlobPath('https://qualitytest.public.blob.vercel-storage.com/' + pathname, pathname), pathname);
    for (const url of [
      'https://evil.example/' + pathname,
      'https://qualitytest.public.blob.vercel-storage.com.evil.example/' + pathname,
      'https://qualitytest.public.blob.vercel-storage.com/' + pathname + '?x=1',
      'https://qualitytest.public.blob.vercel-storage.com/catalog-items/item/images/..%2Fsecret.png',
      'http://qualitytest.public.blob.vercel-storage.com/' + pathname
    ]) assert.throws(() => catalogImageBlobPath(url, pathname));
    assert.throws(() => catalogImageBlobPath('https://qualitytest.public.blob.vercel-storage.com/' + pathname, 'other.png'));
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_MEDIA_BLOB_STORE_ID;
    else process.env.PUBLIC_MEDIA_BLOB_STORE_ID = previous;
  }
});

test('repository image validation reads the file bytes and rejects path escape and low resolution', async () => {
  const root = path.resolve('public/images');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, 'quality-test-'));
  const urlRoot = '/images/' + path.basename(directory);
  try {
    await writeFile(path.join(directory, 'valid.png'), await raster(1024, 1200));
    await writeFile(path.join(directory, 'small.png'), await raster(1024, 400));
    assert.deepEqual(await validateStoredCatalogImage(urlRoot + '/valid.png'), { width: 1024, height: 1200, mimeType: 'image/png' });
    await assert.rejects(validateStoredCatalogImage(urlRoot + '/small.png'), /najmanj 1024/u);
    await assert.rejects(validateStoredCatalogImage('/images/%2e%2e/%2e%2e/package.json'), /javni knjižnici/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('native crop dimensions preserve source detail and reject padding, stretch, and undersized cuts', () => {
  const source = { width: 2400, height: 1600 };
  // Source shown at 25% with its top-left at the canvas origin.
  const transform = [0.25, 0, 0, 0.25, -900, -600];
  assert.deepEqual(getNativeCatalogCropSize({ x: 0, y: 0, width: 600, height: 400 }, source, transform), source);
  assert.deepEqual(getNativeCatalogCropSize({ x: 100, y: 50, width: 400, height: 300 }, source, transform), { width: 1600, height: 1200 });
  assert.throws(() => getNativeCatalogCropSize({ x: 0, y: 0, width: 200, height: 400 }, source, transform), /najmanj 1024/u);
  assert.throws(() => getNativeCatalogCropSize({ x: -1, y: 0, width: 600, height: 400 }, source, transform), /praznega roba/u);
  assert.throws(() => getNativeCatalogCropSize({ x: 0, y: 0, width: 600, height: 400 }, source, [0.25, 0, 0, 0.5, -900, -400]), /razmerja/u);
});

test('downloaded images are bounded while reading, even without Content-Length', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(20 * 1024 * 1024));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() { cancelled = true; }
  });
  await assert.rejects(readLimitedCatalogImageStream(stream), /20 MB/u);
  assert.equal(cancelled, true);
});



test('Vercel validates repository originals through only the configured HTTPS origin without filesystem assets', async (context) => {
  const keys = ['VERCEL', 'NEXT_PUBLIC_SITE_URL', 'ADMIN_AUTH_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.VERCEL = '1';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://catalog-validation.example';
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const nativeBytes = await raster(1400, 1100);
  const fetchMock = context.mock.method(globalThis, 'fetch', async (input: URL | string | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(new Uint8Array(nativeBytes), { headers: { 'content-type': 'image/png' } });
  });
  try {
    assert.deepEqual(await validateStoredCatalogImage('/images/catalog/absent-on-server.png'), { width: 1400, height: 1100, mimeType: 'image/png' });
    assert.equal(calls[0].url, 'https://catalog-validation.example/images/catalog/absent-on-server.png');
    assert.equal(calls[0].init?.redirect, 'error');
    assert.equal(calls[0].init?.cache, 'no-store');
    assert.ok(calls[0].init?.signal instanceof AbortSignal);
    for (const unsafe of ['/images/../secrets', '/images/%2e%2e/secrets', '/images/%252e%252e/secrets', '/images//evil.example/picture.png', '/images/picture.png?proxy=https://evil.example', '/images/%5Cevil.example.png']) {
      await assert.rejects(validateStoredCatalogImage(unsafe), /javni knjižnici/u);
    }
    assert.equal(calls.length, 1);
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
    await assert.rejects(validateStoredCatalogImage('/images/catalog/source.png'), /Izvor javnih slik/u);
    process.env.NEXT_PUBLIC_SITE_URL = 'https://catalog-validation.example';
    fetchMock.mock.mockImplementation(async () => new Response('missing', { status: 404 }));
    await assert.rejects(validateStoredCatalogImage('/images/catalog/source.png'), /ni mogoče preveriti/u);
  } finally {
    fetchMock.mock.restore();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
