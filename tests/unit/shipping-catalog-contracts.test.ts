import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('catalog saves overwrite every client shipping snapshot from physical variant values', () => {
  const serverSource = source('src/shared/server/catalogItems.ts');
  const normalizationStart = serverSource.indexOf(
    'function normalizeCatalogEditorShippingPayload'
  );
  const normalizationEnd = serverSource.indexOf(
    'type PublicCatalogSpecification',
    normalizationStart
  );

  assert.ok(normalizationStart >= 0, 'the server normalization boundary must exist');
  assert.ok(normalizationEnd > normalizationStart, 'the normalization boundary must be inspectable');
  const normalizationSource = serverSource.slice(
    normalizationStart,
    normalizationEnd
  );

  assert.match(
    normalizationSource,
    /deriveCatalogVariantShippingMeasurements[(]variant[)]/u
  );
  assert.match(
    normalizationSource,
    /const itemShipping = normalizeCanonicalShippingMeasurements[(][{][}], 'Artikel'[)]/u
  );

  const inputSpreadIndex = normalizationSource.indexOf('...input');
  const itemSnapshotSpreadIndex = normalizationSource.indexOf(
    '...itemShipping',
    inputSpreadIndex
  );
  assert.ok(inputSpreadIndex >= 0);
  assert.ok(
    itemSnapshotSpreadIndex > inputSpreadIndex,
    'the empty server snapshot must overwrite client item shipping values'
  );

  const variantSpreadIndex = normalizationSource.indexOf('...variant');
  const derivedSnapshotSpreadIndex = normalizationSource.indexOf(
    '...normalizeCanonicalShippingMeasurements',
    variantSpreadIndex
  );
  assert.ok(variantSpreadIndex >= 0);
  assert.ok(
    derivedSnapshotSpreadIndex > variantSpreadIndex,
    'the derived snapshot must overwrite client variant shipping values'
  );

  for (const clientField of [
    'shippingWeightGrams',
    'shippingLengthMm',
    'shippingWidthMm',
    'shippingHeightMm'
  ]) {
    assert.doesNotMatch(
      normalizationSource,
      new RegExp('(?:input|variant)[.]' + clientField, 'u'),
      clientField + ' must never be read as authority'
    );
  }
  assert.doesNotMatch(
    normalizationSource,
    /hasCatalogShippingValue|deriveLegacyCatalogVariantShipping/u
  );
  assert.match(
    serverSource,
    /const payload = normalizeCatalogEditorShippingPayload[(]inputPayload[)];/u
  );
});

test('catalogue list aggregates count only active variants with missing shipping data', () => {
  const serverSource = source('src/shared/server/catalogItems.ts');
  const adminSource = source(
    'src/admin/features/artikli/components/AdminItemsManager.tsx'
  );

  assert.match(
    serverSource,
    /const shippingIssueCount = variants[.]filter[(][^;]*variant[.]status === 'active' && !variant[.]shippingReady[^;]*[)][.]length;/u
  );
  assert.match(
    adminSource,
    /const shippingIssueCount = variants[.]filter[(][^;]*variant[.]active && !variant[.]shippingReady[^;]*[)][.]length;/u
  );
});

test('article list hides shipping status controls without removing readiness calculations', () => {
  const adminSource = source(
    'src/admin/features/artikli/components/AdminItemsManager.tsx'
  );

  assert.doesNotMatch(adminSource, /Poštnina: manjkajo podatki/u);
  assert.doesNotMatch(adminSource, /Poštnina ✓|Poštnina !/u);
  assert.doesNotMatch(adminSource, /shippingFilter|setShippingFilter/u);
  assert.match(
    adminSource,
    /const shippingIssueCount = variants[.]filter[(][^;]*variant[.]active && !variant[.]shippingReady[^;]*[)][.]length;/u
  );
});
