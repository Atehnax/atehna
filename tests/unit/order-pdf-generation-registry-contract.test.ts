import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { ORDER_PDF_TYPE_CONFIGS } from '../../src/shared/domain/order/orderTypes';

test('the generated PDF type excludes purchase orders at the shared domain boundary', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/shared/domain/order/orderTypes.ts'),
    'utf8'
  );

  assert.match(
    source,
    /export type GenerateOrderPdfType\s*=\s*Exclude<\s*OrderPdfTypeKey\s*,\s*'purchase_order'\s*>;/u
  );
});

test('the central PDF registry keeps purchase orders upload-only', () => {
  const purchaseOrder = ORDER_PDF_TYPE_CONFIGS.find(
    (documentType) => documentType.key === 'purchase_order'
  );
  const generatedKeys = ORDER_PDF_TYPE_CONFIGS.filter(
    (documentType) => documentType.canGenerate
  ).map((documentType) => documentType.key);

  assert.ok(purchaseOrder);
  assert.equal(purchaseOrder.canGenerate, false);
  assert.deepEqual(generatedKeys, [
    'order_summary',
    'dobavnica',
    'predracun',
    'invoice'
  ]);
});

test('production template caching stores only the raw settings row', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/shared/server/orderDocumentTemplates.ts'),
    'utf8'
  );

  assert.match(source, /ORDER_DOCUMENT_TEMPLATES_CACHE_VERSION/u);
  assert.match(source, /readOrderDocumentTemplatesRow/u);
  assert.match(
    source,
    /const row = await getCachedOrderDocumentTemplates\(\);\s*if \(!row\) return cloneDefaultOrderDocumentTemplatesConfig\(\);/u
  );
  const cachedReadStart = source.indexOf(
    'async function readOrderDocumentTemplatesRow'
  );
  const cachedReadEnd = source.indexOf(
    'const getCachedOrderDocumentTemplates',
    cachedReadStart
  );
  assert.doesNotMatch(
    source.slice(cachedReadStart, cachedReadEnd),
    /cloneDefaultOrderDocumentTemplatesConfig/u
  );
});

test('the PDF renderer has no generic text-logo fallback', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/shared/server/pdf.ts'),
    'utf8'
  );

  assert.match(
    source,
    /throw new Error\('Required ATEHNA document logo asset is missing\.'\);/u
  );
  assert.match(
    source,
    /const showLogoArtwork = this\.input\.template\.layout\.showLogoMark && Boolean\(this\.logoImage\);/u
  );
  assert.match(source, /logoArtwork\?: Uint8Array \| null/u);
  assert.match(source, /loadDocumentLogo\(doc, input\.logoArtwork\)/u);
  assert.doesNotMatch(source, /naturalLogoWidth|logoSpacing|logoFontSize|logoTextX/u);
});
