import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

test('authentic fallback artwork retains its original primary and secondary colors', async () => {
  const { data, info } = await sharp(resolve(process.cwd(), 'public/brand/atehna-document-wordmark.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1873); assert.equal(info.height, 840);
  const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
  assert.deepEqual(pixel(1500, 350), [194, 169, 24, 255]);
  assert.deepEqual(pixel(1630, 360), [175, 153, 27, 255]);
});

test('every customer PDF producer and the editor preview consume the same published document artwork', () => {
  for (const file of ['src/admin/api/order-document-templates/preview/route.ts', 'src/admin/api/orders/generateOrderDocumentRoute.ts', 'src/shared/server/orderSummaryJobs.ts', 'src/shared/server/quoteDocumentJobs.ts', 'src/shared/server/quoteRequestConfirmationPdf.ts']) {
    const code = source(file);
    assert.match(code, /getDocumentLogoArtwork/u, file);
    assert.doesNotMatch(code, /resolveSiteLogoArtwork|resolveCachedSiteLogoArtwork|getSiteLogoConfig/u, file);
  }
  const adapter = source('src/shared/server/documentLogo.ts');
  assert.match(adapter, /readLogoPublishedOutput\(revision\.png2x\)/u);
  assert.doesNotMatch(adapter, /\.draft\b|readLogoSource/u);
});

test('document editor delegates artwork to the library and saves only document templates', () => {
  const editor = source('src/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor.tsx');
  const canvas = source('src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx');
  const templates = source('src/shared/domain/order/orderDocumentTemplates.ts');
  assert.match(canvas, /<LogoPlacementSelector purpose="pdf-document"/u);
  assert.match(canvas, /order-document-template-style-logoWidthMm/u);
  assert.doesNotMatch(canvas, /SiteLogoTextLayerManager|site-logo-pdf-|updateLogoPresentation/u);
  assert.doesNotMatch(editor, /api\/admin\/site-logo|onLogoConfigChange/u);
  assert.doesNotMatch(templates, /\blogoText\b|\blogoTagline\b|\blogoBackgroundColor\b/u);
});
