import { execFileSync } from 'node:child_process';
import test from 'node:test';

// Exercise the real Blob SDK's headers and decompression with network access disabled.
const run = (body: string) => execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '--eval', `
  import assert from 'node:assert/strict';
  import { brotliCompressSync } from 'node:zlib';
  import { MockAgent, setGlobalDispatcher } from 'undici';
  import { get } from '@vercel/blob';
  import { readLogoPublishedOutput, readLogoSource, readLimitedLogoStream, LOGO_OUTPUT_MAX_BYTES } from './src/shared/server/logoLibraryStorage.ts';
  const mock = new MockAgent(); mock.disableNetConnect(); setGlobalDispatcher(mock);
  const pathname = 'logo-library/published/12345678-1234-1234-1234-123456789abc/logo.svg';
  const asset = { pathname, url: '', width: 1, height: 1, mimeType: 'image/svg+xml' };
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>');
  const response = (body, headers = {}, path = pathname, access = 'public', status = 200) =>
    mock.get('https://logotest.' + access + '.blob.vercel-storage.com')
      .intercept({ path: '/' + path, method: 'GET' }).reply(status, body, { headers: { 'content-type': 'image/svg+xml', ...headers } });
  const metadata = (overrides = {}, status = 200) => mock.get('https://vercel.com')
    .intercept({ path: '/api/blob?' + new URLSearchParams({url: pathname}), method: 'GET' })
    .reply(status, { pathname, size: bytes.length, contentType: 'image/svg+xml', url: 'https://logotest.public.blob.vercel-storage.com/' + pathname, uploadedAt: '2026-09-07T00:00:00Z', ...overrides }, { headers: {'content-type': 'application/json'} });
  try { ${body}; mock.assertNoPendingInterceptors(); } finally { await mock.close(); }
`], { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env: {
  ...process.env, NODE_ENV: 'test', E2E_MODE: '0', VERCEL: '', VERCEL_OIDC_TOKEN: '',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_logotest_test-only', PUBLIC_MEDIA_BLOB_STORE_ID: 'store_logotest',
  ORDER_DOCUMENT_BLOB_STORE_ID: 'store_logotest', VERCEL_BLOB_API_URL: '', NEXT_PUBLIC_VERCEL_BLOB_API_URL: ''
} });

test('published Brotli SVG without Content-Length uses metadata and returns the decoded bytes', () => {
  run(`
    response(brotliCompressSync(bytes), {'content-encoding': 'br', 'transfer-encoding': 'chunked'});
    const sdk = await get(pathname, {access: 'public', storeId: 'store_logotest'});
    assert.equal(sdk.headers.get('content-length'), null); assert.equal(sdk.blob.size, 0);
    assert.deepEqual(Buffer.from(await new Response(sdk.stream).arrayBuffer()), bytes);
    response(brotliCompressSync(bytes), {'content-encoding': 'br', 'transfer-encoding': 'chunked'}); metadata();
    assert.deepEqual(await readLogoPublishedOutput(asset), bytes);
  `);
});

test('compressed transfer length is not mistaken for the decoded output size', () => {
  run(`
    const compressed = brotliCompressSync(bytes); assert.notEqual(compressed.length, bytes.length);
    response(compressed, {'content-encoding': 'br', 'content-length': String(compressed.length)}); metadata();
    assert.deepEqual(await readLogoPublishedOutput(asset), bytes);
  `);
});

test('uncompressed published PNG retains a single GET with no metadata request', () => {
  run(`
    const png = {...asset, pathname: pathname.replace('.svg', '.png'), mimeType: 'image/png'};
    response(bytes, {'content-type': 'image/png; charset=binary', 'content-length': String(bytes.length)}, png.pathname);
    assert.deepEqual(await readLogoPublishedOutput(png), bytes);
  `);
});

test('unknown uncompressed output length uses authoritative metadata', () => {
  run(`response(bytes); metadata(); assert.deepEqual(await readLogoPublishedOutput(asset), bytes);`);
});

test('private source byte count validates compressed and chunked reads without a metadata request', () => {
  run(`
    const source = {...asset, pathname: 'logo-library/sources/12345678-1234-1234-1234-123456789abc.svg', bytes: bytes.length};
    response(brotliCompressSync(bytes), {'content-encoding': 'br'}, source.pathname, 'private');
    assert.deepEqual(Buffer.from(await readLogoSource(source)), bytes);
    response(bytes, {}, source.pathname, 'private');
    assert.deepEqual(Buffer.from(await readLogoSource(source)), bytes);
  `);
});

test('source recorded byte count still rejects changed contents with or without transport length', () => {
  run(`
    const source = {...asset, pathname: 'logo-library/sources/12345678-1234-1234-1234-123456789abc.svg', bytes: bytes.length + 1};
    response(bytes, {'content-length': String(bytes.length)}, source.pathname, 'private');
    await assert.rejects(() => readLogoSource(source), /spremenila/u);
    response(brotliCompressSync(bytes), {'content-encoding': 'br'}, source.pathname, 'private');
    await assert.rejects(() => readLogoSource(source), /ni v celoti prenesena/u);
  `);
});

test('unknown-length empty and truncated streams cannot pass the metadata size check', () => {
  run(`
    for (const body of [Buffer.alloc(0), bytes.subarray(0, -1)]) {
      response(body); metadata();
      await assert.rejects(() => readLogoPublishedOutput(asset), /ni v celoti prenesena/u);
    }
  `);
});

test('declared uncompressed truncation remains rejected', () => {
  run(`
    response(bytes.subarray(0, -1), {'content-length': String(bytes.length)});
    await assert.rejects(() => readLogoPublishedOutput(asset));
  `);
});

test('invalid paths and response MIME types are rejected before metadata or content use', () => {
  run(`
    await assert.rejects(() => readLogoPublishedOutput({...asset, pathname: '../logo.svg'}), /Pot logotipa/u);
    response(bytes, {'content-type': 'text/html'});
    await assert.rejects(() => readLogoPublishedOutput(asset), /se ne ujema/u);
  `);
});

test('metadata pathname, MIME and finite positive bounded sizes are enforced', () => {
  run(`
    for (const fields of [{pathname: 'other.svg'}, {contentType: 'text/html'}, {size: 0}, {size: -1}, {size: 0.5}, {size: null}, {size: LOGO_OUTPUT_MAX_BYTES + 1}]) {
      response(bytes); metadata(fields);
      await assert.rejects(() => readLogoPublishedOutput(asset), /se ne ujema/u);
    }
  `);
});

test('invalid advertised lengths fail closed instead of being treated as absent', () => {
  run(`
    for (const length of ['0', '-1', 'NaN', '1x', '1.5', String(LOGO_OUTPUT_MAX_BYTES + 1)]) {
      response(bytes, {'content-length': length});
      await assert.rejects(() => readLogoPublishedOutput(asset));
    }
  `);
});

test('decoded compressed overflow remains bounded even when metadata advertises a small file', () => {
  run(`
    response(brotliCompressSync(Buffer.alloc(LOGO_OUTPUT_MAX_BYTES + 1)), {'content-encoding': 'br'}); metadata();
    await assert.rejects(() => readLogoPublishedOutput(asset), error => error.status === 413);
  `);
});

test('stream errors propagate and overflowing streams are cancelled and unlocked', () => {
  run(`
    let cancelled = false;
    const overflow = new ReadableStream({start(controller) { controller.enqueue(new Uint8Array(5)); }, cancel() {cancelled = true;}});
    await assert.rejects(() => readLimitedLogoStream(overflow, 4), error => error.status === 413);
    assert.equal(cancelled, true); assert.equal(overflow.locked, false);
    const broken = new ReadableStream({pull(controller) {controller.error(new Error('broken stream'));}});
    await assert.rejects(() => readLimitedLogoStream(broken, 4), /broken stream/u);
    assert.equal(broken.locked, false);
  `);
});

test('missing object and failed authoritative metadata reads remain failures', () => {
  run(`
    response('', {}, pathname, 'public', 404);
    await assert.rejects(() => readLogoPublishedOutput(asset), error => error.status === 404);
    response(bytes); metadata({error: {code: 'not_found', message: 'missing'}}, 404);
    await assert.rejects(() => readLogoPublishedOutput(asset));
  `);
});
