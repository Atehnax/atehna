import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  SITE_LOGO_PURPOSE_CATALOG,
  isTrustedSiteLogoMasterSource
} from '@/shared/domain/logo/siteLogo';

const saveRouteSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/logoLibrary.ts'),
  'utf8'
);
const publicRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/site-logo/[purpose]/route.ts'),
  'utf8'
);
const artworkCacheSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/logoLibraryStorage.ts'),
  'utf8'
);

const pathname = 'site-logo/masters/full-lockup/12345678-logo.svg';
const url = `https://store.public.blob.vercel-storage.com/${pathname}`;

test('trusted logo storage accepts only an exact canonical Vercel Blob object', () => {
  assert.equal(isTrustedSiteLogoMasterSource({ pathname, url }), true);

  const hostile: Array<{ pathname: string; url: string }> = [
    { pathname: `prefix/${pathname}`, url: `https://store.public.blob.vercel-storage.com/prefix/${pathname}` },
    { pathname: 'site-logo/masters/../12345678-logo.svg', url },
    { pathname, url: `https://store.public.blob.vercel-storage.com/site-logo/masters/full-lockup%2F12345678-logo.svg` },
    { pathname, url: `${url}?download=1` },
    { pathname, url: `${url}#fragment` },
    { pathname, url: url.replace('https:', 'http:') },
    { pathname, url: url.replace('store.public.', 'user:pass@store.public.') },
    { pathname, url: url.replace('.com/', '.com:444/') },
    { pathname, url: url.replace('blob.vercel-storage.com', 'blob.vercel-storage.com.evil.example') },
    { pathname, url: url.replace('/site-logo/', '/other/') }
  ];
  for (const candidate of hostile) {
    assert.equal(
      isTrustedSiteLogoMasterSource(candidate),
      false,
      `${candidate.pathname} ${candidate.url}`
    );
  }
});

test('source and extended-canvas dimensions fail closed at explicit raster budgets', () => {
  const script = String.raw`
    const {
      SITE_LOGO_MAX_CANVAS_PIXELS,
      SITE_LOGO_MAX_SOURCE_DIMENSION,
      SITE_LOGO_MAX_SOURCE_PIXELS,
      assertSiteLogoRasterBudget
    } = await import('./src/shared/server/siteLogoArtworkCore.ts');
    const { resolveSiteLogoCanvasLayout } = await import('./src/shared/domain/logo/siteLogo.ts');
    const validLayout = resolveSiteLogoCanvasLayout(4000, 4000, {});
    const invoke = (sourceWidth, sourceHeight, edges) => {
      try {
        assertSiteLogoRasterBudget(
          sourceWidth,
          sourceHeight,
          resolveSiteLogoCanvasLayout(sourceWidth, sourceHeight, edges)
        );
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    };
    process.stdout.write(JSON.stringify({
      sourcePixels: validLayout.width * validLayout.height,
      maxSourcePixels: SITE_LOGO_MAX_SOURCE_PIXELS,
      maxCanvasPixels: SITE_LOGO_MAX_CANVAS_PIXELS,
      valid: invoke(4000, 4000, {}),
      sourceOverflow: invoke(SITE_LOGO_MAX_SOURCE_DIMENSION + 1, 1, {}),
      canvasOverflow: invoke(4000, 4000, { right: 0.01 })
    }));
  `;
  const result = JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server',
    '--import',
    'tsx',
    '--input-type=module',
    '--eval',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  })) as {
    sourcePixels: number;
    maxSourcePixels: number;
    maxCanvasPixels: number;
    valid: { ok: boolean; message?: string };
    sourceOverflow: { ok: boolean; message?: string };
    canvasOverflow: { ok: boolean; message?: string };
  };

  assert.equal(result.sourcePixels, result.maxSourcePixels);
  assert.equal(result.maxCanvasPixels, 16_000_000);
  assert.deepEqual(result.valid, { ok: true });
  assert.equal(result.sourceOverflow.ok, false);
  assert.match(result.sourceOverflow.message ?? '', /source dimensions exceed/u);
  assert.equal(result.canvasOverflow.ok, false);
  assert.match(result.canvasOverflow.message ?? '', /canvas dimensions exceed/u);
});

test('server content validation rejects active, external, obfuscated, and over-complex SVG payloads', () => {
  const script = String.raw`
    const pathname = 'site-logo/masters/full-lockup/12345678-logo.svg';
    const url = 'https://store.public.blob.vercel-storage.com/' + pathname;
    let responseBytes = Buffer.alloc(0);
    let responseType = 'image/svg+xml';
    globalThis.fetch = async () => new Response(responseBytes, {
      status: 200,
      headers: {
        'content-type': responseType,
        'content-length': String(responseBytes.byteLength)
      }
    });
    const { validateSiteLogoMasterContent } = await import('./src/shared/server/siteLogoArtworkCore.ts');

    const masterFor = (bytes, overrides = {}) => ({
      id: 'full-lockup', label: 'Test', kind: 'lockup', tone: 'default',
      url, pathname, mimeType: 'image/svg+xml', size: bytes.byteLength,
      intrinsicWidth: 2, intrinsicHeight: 2,
      opticalBounds: { x: 0, y: 0, width: 1, height: 1 },
      ...overrides
    });
    const invoke = async (source, overrides = {}) => {
      responseBytes = Buffer.from(source);
      const master = masterFor(responseBytes, overrides);
      responseType = master.mimeType;
      globalThis.__siteLogoHeadResponse = {
        pathname: master.pathname,
        url: master.url,
        size: master.size,
        contentType: master.mimeType
      };
      try {
        const result = await validateSiteLogoMasterContent(master);
        return { ok: true, width: result.width, height: result.height };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    };

    const safe = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><defs><linearGradient id="g"/></defs><rect id="r" width="2" height="2" fill="url(#g)"/><use href="#r"/></svg>';
    const hostile = [
      ['script', '<svg width="2" height="2"><script>alert(1)</script></svg>'],
      ['prefixed-script', '<svg width="2" height="2"><x:script/></svg>'],
      ['foreign-object', '<svg width="2" height="2"><foreignObject/></svg>'],
      ['doctype', '<!DOCTYPE svg><svg width="2" height="2"/>'],
      ['entity', '<!ENTITY x "boom"><svg width="2" height="2"/>'],
      ['stylesheet', '<?xml-stylesheet href="https://evil.example/a.css"?><svg width="2" height="2"/>'],
      ['event', '<svg width="2" height="2" onload="alert(1)"/>'],
      ['entity-event', '<svg width="2" height="2" o&#110;load="alert(1)"/>'],
      ['external-href', '<svg width="2" height="2"><image href="https://evil.example/a.png"/></svg>'],
      ['external-xlink', '<svg width="2" height="2"><use xlink:href="https://evil.example/a.svg#x"/></svg>'],
      ['css-import', '<svg width="2" height="2"><style>@import "https://evil.example/a.css"</style></svg>'],
      ['escaped-import', '<svg width="2" height="2"><style>@\\69mport "https://evil.example/a.css"</style></svg>'],
      ['css-url', '<svg width="2" height="2"><rect style="fill:url(https://evil.example/a.svg#x)"/></svg>'],
      ['comment-url', '<svg width="2" height="2"><rect style="fill:u/**/rl(https://evil.example/a.svg#x)"/></svg>'],
      ['escaped-url', '<svg width="2" height="2"><rect style="fill:u\\72l(https://evil.example/a.svg#x)"/></svg>'],
      ['xml-base', '<svg width="2" height="2" xml:base="https://evil.example/"><use href="#x"/></svg>'],
      ['base-element', '<svg width="2" height="2"><x:base href="https://evil.example/"/></svg>'],
      ['complexity', '<svg width="2" height="2">' + '<rect/>'.repeat(5001) + '</svg>']
    ];
    const safeResult = await invoke(safe);
    const hostileResults = [];
    for (const [name, source] of hostile) hostileResults.push([name, await invoke(source)]);
    const mimeMismatch = await invoke(safe, { mimeType: 'image/png' });
    const dimensionMismatch = await invoke(safe, { intrinsicWidth: 3 });
    process.stdout.write(JSON.stringify({ safeResult, hostileResults, mimeMismatch, dimensionMismatch }));
  `;
  const result = JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server',
    '--import',
    'tsx',
    '--loader',
    './tests/unit/fixtures/site-logo-vercel-blob-loader.mjs',
    '--input-type=module',
    '--eval',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, PUBLIC_MEDIA_BLOB_STORE_ID: 'test-store' }
  })) as {
    safeResult: { ok: boolean; width?: number; height?: number; message?: string };
    hostileResults: Array<[string, { ok: boolean; message?: string }]>;
    mimeMismatch: { ok: boolean; message?: string };
    dimensionMismatch: { ok: boolean; message?: string };
  };

  assert.deepEqual(result.safeResult, { ok: true, width: 2, height: 2 });
  for (const [name, outcome] of result.hostileResults) {
    assert.equal(outcome.ok, false, `${name} unexpectedly passed content validation`);
    assert.ok(outcome.message, `${name} did not produce a diagnostic`);
  }
  assert.equal(result.mimeMismatch.ok, false);
  assert.match(result.mimeMismatch.message ?? '', /bytes do not match|decoder format/u);
  assert.equal(result.dimensionMismatch.ok, false);
  assert.match(result.dimensionMismatch.message ?? '', /dimensions do not match/u);
});

test('library save validates projects before persistence and public mutations refresh published output', () => {
  const mutation = saveRouteSource.slice(saveRouteSource.indexOf('export async function mutateLogoLibrary'), saveRouteSource.indexOf('export async function uploadLogoLibrarySource'));
  assert.match(mutation, /requireLogoRevision\(snapshot\.revision, input\.expectedRevision\)/u);
  assert.ok(mutation.indexOf('validateProject(') < mutation.indexOf('commitLogoLibraryChange('));
  assert.ok(mutation.indexOf('createLogoPublication(') < mutation.indexOf('commitLogoLibraryChange('));
  assert.match(mutation, /if \(publicChanged\) revalidatePublishedLogos\(\)/u);
  assert.match(saveRouteSource, /revalidateTag\(LOGO_LIBRARY_PUBLIC_CACHE_TAG, \{ expire: 0 \}\)/u);
  assert.match(saveRouteSource, /for \(const purpose of LOGO_PLACEMENT_IDS\) revalidatePath/u);
});

test('public output is immutable, bounded and separate from private originals', () => {
  assert.match(artworkCacheSource, /LOGO_OUTPUT_MAX_BYTES/u);
  assert.match(artworkCacheSource, /addRandomSuffix: false, allowOverwrite: false/u);
  assert.match(artworkCacheSource, /access: privateSource \? 'private' : 'public'/u);
  assert.match(artworkCacheSource, /cacheControlMaxAge: 365 \* 24 \* 60 \* 60/u);
  assert.match(artworkCacheSource, /readLimitedLogoStream\(result\.stream, maximum\)/u);
  assert.match(artworkCacheSource, /result\.blob\.pathname !== pathname/u);
  assert.match(publicRouteSource, /getPublishedSiteLogos\(\)/u);
  assert.match(publicRouteSource, /readLogoPublishedOutput\(revision\.png2x\)/u);
  assert.match(publicRouteSource, /max-age=0, must-revalidate/u);
  assert.match(publicRouteSource, /status: 503/u);
  assert.doesNotMatch(publicRouteSource, /resolveCachedSiteLogoArtwork|readLogoSource|draft/u);
});
