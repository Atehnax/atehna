import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

const logoAssetPath = resolve(
  process.cwd(),
  'public/brand/atehna-document-wordmark.png'
);
const canvasSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'
  ),
  'utf8'
);
const editorSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor.tsx'
  ),
  'utf8'
);
const pageSource = readFileSync(
  resolve(process.cwd(), 'src/admin/pages/urejevalnik/page.tsx'),
  'utf8'
);
const rendererSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/pdf.ts'),
  'utf8'
);
const previewRouteSource = readFileSync(
  resolve(process.cwd(), 'src/admin/api/order-document-templates/preview/route.ts'),
  'utf8'
);
const generationRouteSource = readFileSync(
  resolve(process.cwd(), 'src/admin/api/orders/generateOrderDocumentRoute.ts'),
  'utf8'
);
const summaryJobsSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/orderSummaryJobs.ts'),
  'utf8'
);
const artworkRendererSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/siteLogoArtwork.ts'),
  'utf8'
);
const sharedArtworkSource = readFileSync(
  resolve(process.cwd(), 'src/shared/components/SiteLogoArtwork.tsx'),
  'utf8'
);
const logoDomainSource = readFileSync(
  resolve(process.cwd(), 'src/shared/domain/logo/siteLogo.ts'),
  'utf8'
);
const orderTemplateSource = readFileSync(
  resolve(process.cwd(), 'src/shared/domain/order/orderDocumentTemplates.ts'),
  'utf8'
);

test('authentic PDF artwork keeps the full final A primary and d.o.o. secondary', async () => {
  const { data, info } = await sharp(logoAssetPath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1873);
  assert.equal(info.height, 840);
  assert.equal(info.channels, 4);

  const pixel = (x: number, y: number) => {
    const offset = (y * info.width + x) * info.channels;
    return [...data.subarray(offset, offset + info.channels)];
  };
  assert.deepEqual(pixel(1500, 350), [194, 169, 24, 255]);
  assert.deepEqual(pixel(1520, 350), [194, 169, 24, 255]);
  assert.deepEqual(pixel(1630, 360), [175, 153, 27, 255]);
});

test('PDF renderer resolves the shared authentic artwork and never reconstructs a one-color wordmark', () => {
  assert.match(logoDomainSource, /atehna-document-wordmark\.png/u);
  assert.match(rendererSource, /logoArtwork\?: Uint8Array \| null/u);
  assert.match(rendererSource, /loadDocumentLogo\(doc, input\.logoArtwork\)/u);
  assert.match(rendererSource, /drawImage\(this\.logoImage/u);
  assert.match(artworkRendererSource, /renderBuiltInAtehnaLogoArtwork/u);
  assert.match(artworkRendererSource, /masks\.secondary/u);
  assert.match(sharedArtworkSource, /SITE_LOGO_BUILTIN_MASK_URLS\.secondary/u);
  assert.match(
    sharedArtworkSource,
    /const preserveOriginal = builtIn && isDefaultSiteLogoPresentation\(presentation\)/u
  );
  assert.match(
    sharedArtworkSource,
    /preserveOriginal[\s\S]*?<Image[\s\S]*?src=\{master\.url\}/u
  );
  for (const source of [previewRouteSource, generationRouteSource, summaryJobsSource]) {
    assert.match(source, /resolveSiteLogoArtwork/u);
    assert.match(source, /logoArtwork/u);
  }
  assert.doesNotMatch(rendererSource, /drawText\([^\n]*logoText/u);
});

test('shared server artwork applies both yellow channels, backgrounds, outline, and artwork shadow', () => {
  const script = String.raw`
    const { renderBuiltInAtehnaLogoArtwork } = await import('./src/shared/server/siteLogoArtwork.ts');
    const { readFile } = await import('node:fs/promises');
    const sharp = (await import('sharp')).default;
    const originalBytes = await readFile('./public/brand/atehna-document-wordmark.png');
    const defaultBytes = await renderBuiltInAtehnaLogoArtwork();
    const presentation = {
      backgroundColor: '#0A0B0C',
      taglineBackgroundColor: '#1A1B1C',
      primaryTextColor: '#112233',
      secondaryTextColor: '#445566',
      taglineTextColor: '#778899',
      outline: { enabled: true, color: '#FF00FF', widthPx: 3 },
      shadow: { enabled: true, color: '#00FFFF', opacity: 1, blurPx: 0, offsetXpx: 12, offsetYpx: 12 }
    };
    const bytes = await renderBuiltInAtehnaLogoArtwork(presentation);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const targets = new Map([
      ['background', '0A0B0C'],
      ['taglineBackground', '1A1B1C'],
      ['primary', '112233'],
      ['secondary', '445566'],
      ['tagline', '778899'],
      ['outline', 'FF00FF'],
      ['shadow', '00FFFF']
    ]);
    const counts = Object.fromEntries([...targets.keys()].map((key) => [key, 0]));
    for (let index = 0; index < data.length; index += info.channels) {
      const hex = [data[index], data[index + 1], data[index + 2]]
        .map((value) => value.toString(16).padStart(2, '0').toUpperCase())
        .join('');
      for (const [key, target] of targets) if (hex === target) counts[key] += 1;
    }
    const pixel = (x, y) => {
      const offset = (y * info.width + x) * info.channels;
      return [...data.subarray(offset, offset + 4)];
    };
    process.stdout.write(JSON.stringify({
      width: info.width,
      height: info.height,
      defaultMatchesOriginal: Buffer.from(defaultBytes).equals(originalBytes),
      counts,
      finalA: { left: pixel(1500, 350), right: pixel(1520, 350) },
      suffix: pixel(1630, 360)
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
    width: number;
    height: number;
    defaultMatchesOriginal: boolean;
    counts: Record<string, number>;
    finalA: { left: number[]; right: number[] };
    suffix: number[];
  };

  assert.equal(result.width, 1873);
  assert.equal(result.height, 840);
  assert.equal(result.defaultMatchesOriginal, true);
  assert.deepEqual(result.finalA.left, [17, 34, 51, 255]);
  assert.deepEqual(result.finalA.right, [17, 34, 51, 255]);
  assert.deepEqual(result.suffix, [68, 85, 102, 255]);
  for (const channel of [
    'background',
    'taglineBackground',
    'primary',
    'secondary',
    'tagline',
    'outline',
    'shadow'
  ]) {
    assert.ok(result.counts[channel] > 0, `Rendered ${channel} channel is missing.`);
  }
});

test('Urejevalnik consumes the shared pdf-document placement in its floating toolbar', () => {
  assert.match(pageSource, /getSiteLogoConfig/u);
  assert.match(editorSource, /initialLogoConfig/u);
  assert.match(editorSource, /\/api\/admin\/site-logo/u);
  assert.match(editorSource, /logoConfig/u);
  assert.match(canvasSource, /resolveSiteLogoPresentation/u);
  assert.match(canvasSource, /SiteLogoProvider/u);
  assert.match(canvasSource, /<SiteLogo\b/u);
  assert.match(canvasSource, /['"]pdf-document['"]/u);
  assert.match(canvasSource, /data-logo-use-case=["'{]pdf-document/u);
  assert.match(canvasSource, /data-logo-context-toolbar=/u);
  assert.match(canvasSource, /data-logo-toolbar-panel="appearance"/u);
  assert.match(canvasSource, /<CompactHexColorField\b/u);
  assert.match(canvasSource, /<FloatingAppearanceEditorContextToolbar\b/u);
  assert.doesNotMatch(canvasSource, /<aside\b/u);
});

test('order templates no longer own conflicting PDF-only logo colors', () => {
  assert.doesNotMatch(orderTemplateSource, /\blogoBackgroundColor\b/u);
  assert.doesNotMatch(orderTemplateSource, /\blogoTextColor\b/u);
  assert.doesNotMatch(canvasSource, /order-document-template-style-logo(?:Background|Text)Color/u);
});

test('all shared PDF presentation colors, outline, and artwork shadow are editable contextually', () => {
  for (const field of [
    'backgroundColor',
    'taglineBackgroundColor',
    'primaryTextColor',
    'secondaryTextColor',
    'taglineTextColor',
    'outline.enabled',
    'outline.color',
    'outline.widthPx',
    'shadow.enabled',
    'shadow.color',
    'shadow.opacity',
    'shadow.blurPx',
    'shadow.offsetXpx',
    'shadow.offsetYpx'
  ]) {
    assert.ok(
      canvasSource.includes(`data-logo-presentation-control="${field}"`)
        || canvasSource.includes(`marker="${field}"`),
      `Missing shared PDF logo presentation control: ${field}`
    );
  }
});
