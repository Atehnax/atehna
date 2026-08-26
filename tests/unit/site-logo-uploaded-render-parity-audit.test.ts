import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const adminLogoSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/podoba/components/AdminLogoPageClient.tsx'
), 'utf8');
const clientArtworkSource = readFileSync(resolve(
  process.cwd(),
  'src/shared/components/SiteLogoArtwork.tsx'
), 'utf8');

test('uploaded logos preserve signed edges, one canvas background, and independent effects', () => {
  const script = String.raw`
    const sharp = (await import('sharp')).default;
    const {
      DEFAULT_SITE_LOGO_PRESENTATION,
      cloneDefaultSiteLogoConfig
    } = await import('./src/shared/domain/logo/siteLogo.ts');

    const width = 8;
    const height = 8;
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 3; y <= 4; y += 1) {
      for (let x = 3; x <= 4; x += 1) {
        const offset = (y * width + x) * 4;
        rgba[offset] = 0x11;
        rgba[offset + 1] = 0x22;
        rgba[offset + 2] = 0x33;
        rgba[offset + 3] = 0xff;
      }
    }
    const sourceBytes = await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer();
    const pathname = 'site-logo/masters/full-lockup/12345678-uploaded-audit.png';
    const url = 'https://store.public.blob.vercel-storage.com/' + pathname;
    const master = {
      id: 'uploaded-audit',
      label: 'Uploaded audit',
      kind: 'lockup',
      tone: 'default',
      url,
      pathname,
      filename: 'uploaded-audit.png',
      mimeType: 'image/png',
      size: sourceBytes.byteLength,
      intrinsicWidth: width,
      intrinsicHeight: height,
      opticalBounds: { x: 0, y: 0, width: 1, height: 1 }
    };
    globalThis.__siteLogoHeadResponse = {
      pathname,
      url,
      size: sourceBytes.byteLength,
      contentType: 'image/png'
    };
    globalThis.fetch = async () => new Response(sourceBytes, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-length': String(sourceBytes.byteLength)
      }
    });

    const { resolveSiteLogoArtwork } = await import('./src/shared/server/siteLogoArtworkCore.ts');
    const basePresentation = structuredClone(DEFAULT_SITE_LOGO_PRESENTATION);
    Object.assign(basePresentation, {
      backgroundColor: '#010203',
      taglineBackgroundColor: '#F0E0D0',
      canvasEdges: { left: 0.25, right: -0.125, top: 0.125, bottom: 0.25 },
      transparentColors: { background: true },
      outline: { enabled: false, color: '#FF00FF', widthPx: 0 },
      shadow: { enabled: false, color: '#00FFFF', opacity: 0, blurPx: 0, offsetXpx: 0, offsetYpx: 0 }
    });

    const render = async (presentation) => {
      const config = cloneDefaultSiteLogoConfig();
      config.masters = [master];
      config.placements.standalone = {
        ...config.placements.standalone,
        enabled: true,
        masterId: master.id,
        presentation
      };
      const artwork = await resolveSiteLogoArtwork(config, 'standalone');
      return sharp(artwork.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    };
    const count = ({ data, info }, rgb) => {
      let total = 0;
      for (let offset = 0; offset < data.length; offset += info.channels) {
        if (data[offset] === rgb[0] && data[offset + 1] === rgb[1]
          && data[offset + 2] === rgb[2] && data[offset + 3] === 0xff) total += 1;
      }
      return total;
    };

    const transparent = await render(basePresentation);
    const opaquePresentation = structuredClone(basePresentation);
    opaquePresentation.transparentColors = {};
    const opaque = await render(opaquePresentation);
    const alternateTagline = structuredClone(basePresentation);
    alternateTagline.taglineBackgroundColor = '#ABCDEF';
    alternateTagline.transparentColors = { background: true, taglineBackground: true };
    const taglineIgnored = await render(alternateTagline);
    const effectsPresentation = structuredClone(basePresentation);
    effectsPresentation.outline = { enabled: true, color: '#FF00FF', widthPx: 1 };
    effectsPresentation.shadow = {
      enabled: true,
      color: '#00FFFF',
      opacity: 1,
      blurPx: 0,
      offsetXpx: 2,
      offsetYpx: 2
    };
    const effects = await render(effectsPresentation);

    process.stdout.write(JSON.stringify({
      dimensions: { width: transparent.info.width, height: transparent.info.height },
      transparentAlpha: Array.from(transparent.data).filter((_value, index) => index % 4 === 3 && transparent.data[index] > 0).length,
      transparentBlue: count(transparent, [0x11, 0x22, 0x33]),
      extensionAlpha: transparent.data[3],
      opaqueBackground: Array.from(opaque.data.subarray(0, 4)),
      opaqueBlue: count(opaque, [0x11, 0x22, 0x33]),
      taglineIgnored: Buffer.from(transparent.data).equals(Buffer.from(taglineIgnored.data)),
      effectsBlue: count(effects, [0x11, 0x22, 0x33]),
      effectsOutline: count(effects, [0xff, 0x00, 0xff]),
      effectsShadow: count(effects, [0x00, 0xff, 0xff])
    }));
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
    dimensions: { width: number; height: number };
    transparentAlpha: number;
    transparentBlue: number;
    extensionAlpha: number;
    opaqueBackground: number[];
    opaqueBlue: number;
    taglineIgnored: boolean;
    effectsBlue: number;
    effectsOutline: number;
    effectsShadow: number;
  };

  assert.deepEqual(result.dimensions, { width: 9, height: 11 });
  assert.equal(result.transparentAlpha, 4);
  assert.equal(result.transparentBlue, 4);
  assert.equal(result.extensionAlpha, 0);
  assert.deepEqual(result.opaqueBackground, [1, 2, 3, 255]);
  assert.equal(result.opaqueBlue, 4);
  assert.equal(result.taglineIgnored, true);
  assert.equal(result.effectsBlue, 4);
  assert.ok(result.effectsOutline > 0);
  assert.ok(result.effectsShadow > 0);
});

test('Admin preview hides unsupported uploaded channels and measures the real effect scale', () => {
  const backgroundIndex = adminLogoSource.indexOf('channel="background"');
  const capabilityIndex = adminLogoSource.indexOf('capabilities.artworkColors ? (', backgroundIndex);
  const taglineIndex = adminLogoSource.indexOf('channel="taglineBackground"', capabilityIndex);
  assert.ok(backgroundIndex >= 0);
  assert.ok(capabilityIndex > backgroundIndex);
  assert.ok(taglineIndex > capabilityIndex);

  assert.match(adminLogoSource, /function MeasuredSiteLogoArtwork/u);
  assert.match(adminLogoSource, /getBoundingClientRect\(\)/u);
  assert.match(
    adminLogoSource,
    /rect\.width\s*\/\s*Math\.max\(1, canvasLayout\.width\)[\s\S]{0,160}rect\.height\s*\/\s*Math\.max\(1, canvasLayout\.height\)/u
  );
  assert.match(adminLogoSource, /effectScale=\{effectScale\}/u);
  assert.equal(
    adminLogoSource.match(/<MeasuredSiteLogoArtwork\b/gu)?.length ?? 0,
    2
  );
  assert.match(clientArtworkSource, /effectScale\?: number/u);
});
