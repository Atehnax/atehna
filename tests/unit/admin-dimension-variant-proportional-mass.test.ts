import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  applyProportionalVariantWeights,
  createVariant,
  type Variant
} from '@/admin/features/artikli/lib/familyModel';

const variant = (
  id: string,
  dimensions: [length: number | null, width: number | null, thickness: number | null],
  weight: number | null,
  overrides: Partial<Variant> = {}
): Variant => createVariant({
  id,
  label: id,
  sku: id.toUpperCase(),
  length: dimensions[0],
  width: dimensions[1],
  thickness: dimensions[2],
  weight,
  ...overrides
});

test('proportional mass uses the expanded variant volume basis and preserves all other data', () => {
  const variants = [
    variant('source', [100, 100, 0.5], 0.02, { stock: 11, active: true }),
    variant('large', [200, 200, 0.5], 0.01, { stock: 7, active: false }),
    variant('same-volume', [50, 200, 0.5], 0.02, { price: 19.9 }),
    variant('incomplete', [200, null, 0.5], 0.123, { sku: 'KEEP-ME' })
  ];
  const before = structuredClone(variants);

  const result = applyProportionalVariantWeights(variants, 'source');

  assert.equal(result.error, null);
  assert.deepEqual(result.changedVariantIds, ['large']);
  assert.deepEqual(result.eligibleVariantIds, ['large', 'same-volume']);
  assert.deepEqual(result.skippedVariantIds, ['incomplete']);
  assert.equal(result.variants[0], variants[0]);
  assert.equal(result.variants[1].weight, 0.08);
  assert.equal(result.variants[1].active, false);
  assert.equal(result.variants[1].stock, 7);
  assert.equal(result.variants[2], variants[2]);
  assert.equal(result.variants[3], variants[3]);
  assert.equal(result.variants.length, variants.length);
  assert.deepEqual(variants, before);
});

test('proportional mass scales every axis and rounds calculated values to whole grams', () => {
  const variants = [
    variant('source', [10, 10, 10], 0.001),
    variant('length-x2', [20, 10, 10], null),
    variant('width-x2', [10, 20, 10], null),
    variant('thickness-x2', [10, 10, 20], null),
    variant('all-x2', [20, 20, 20], null),
    variant('round-down', [254, 10, 10], null),
    variant('round-up', [255, 10, 10], null)
  ];

  const result = applyProportionalVariantWeights(variants, 'source');

  assert.equal(result.error, null);
  assert.deepEqual(
    Object.fromEntries(result.variants.map((entry) => [entry.id, entry.weight])),
    {
      source: 0.001,
      'length-x2': 0.002,
      'width-x2': 0.002,
      'thickness-x2': 0.002,
      'all-x2': 0.008,
      'round-down': 0.025,
      'round-up': 0.026
    }
  );
});

test('invalid source dimensions or mass abort atomically', () => {
  const cases: Array<{
    source: Variant;
    error: 'SOURCE_DIMENSIONS_INVALID' | 'SOURCE_WEIGHT_INVALID';
  }> = [
    { source: variant('source', [null, 10, 10], 0.02), error: 'SOURCE_DIMENSIONS_INVALID' },
    { source: variant('source', [0, 10, 10], 0.02), error: 'SOURCE_DIMENSIONS_INVALID' },
    { source: variant('source', [-1, 10, 10], 0.02), error: 'SOURCE_DIMENSIONS_INVALID' },
    { source: variant('source', [Number.NaN, 10, 10], 0.02), error: 'SOURCE_DIMENSIONS_INVALID' },
    { source: variant('source', [Number.POSITIVE_INFINITY, 10, 10], 0.02), error: 'SOURCE_DIMENSIONS_INVALID' },
    { source: variant('source', [10, 10, 10], null), error: 'SOURCE_WEIGHT_INVALID' },
    { source: variant('source', [10, 10, 10], 0), error: 'SOURCE_WEIGHT_INVALID' },
    { source: variant('source', [10, 10, 10], -0.02), error: 'SOURCE_WEIGHT_INVALID' },
    { source: variant('source', [10, 10, 10], 0.0205), error: 'SOURCE_WEIGHT_INVALID' },
    { source: variant('source', [10, 10, 10], Number.NaN), error: 'SOURCE_WEIGHT_INVALID' },
    { source: variant('source', [10, 10, 10], Number.POSITIVE_INFINITY), error: 'SOURCE_WEIGHT_INVALID' }
  ];

  for (const entry of cases) {
    const variants = [entry.source, variant('target', [20, 20, 20], 0.5)];
    const result = applyProportionalVariantWeights(variants, 'source');
    assert.equal(result.error, entry.error);
    assert.equal(result.variants, variants);
    assert.deepEqual(result.changedVariantIds, []);
  }
});

test('invalid or unrepresentable targets are skipped while valid siblings are updated', () => {
  const variants = [
    variant('source', [1, 1, 1], 0.001),
    variant('valid', [2, 1, 1], null),
    variant('incomplete', [2, null, 1], 0.4),
    variant('zero', [2, 0, 1], 0.4),
    variant('tiny', [0.4, 1, 1], 0.4),
    variant('too-large', [1_000_000, 1_000_000, 1], 0.4)
  ];

  const result = applyProportionalVariantWeights(variants, 'source');

  assert.equal(result.variants.find((entry) => entry.id === 'valid')?.weight, 0.002);
  assert.deepEqual(result.changedVariantIds, ['valid']);
  assert.deepEqual(result.eligibleVariantIds, ['valid']);
  assert.deepEqual(result.skippedVariantIds, [
    'incomplete',
    'zero',
    'tiny',
    'too-large'
  ]);
  for (const id of result.skippedVariantIds) {
    assert.equal(result.variants.find((entry) => entry.id === id)?.weight, 0.4);
  }
});

test('missing sources, single variants, and already-correct targets are stable no-ops', () => {
  const source = variant('source', [100, 100, 0.5], 0.02);
  const correctTarget = variant('target', [200, 200, 0.5], 0.08);
  const variants = [source, correctTarget];

  const missing = applyProportionalVariantWeights(variants, 'missing');
  assert.equal(missing.error, 'SOURCE_VARIANT_NOT_FOUND');
  assert.equal(missing.variants, variants);

  const single = [source];
  const singleResult = applyProportionalVariantWeights(single, 'source');
  assert.equal(singleResult.error, null);
  assert.equal(singleResult.variants, single);
  assert.deepEqual(singleResult.eligibleVariantIds, []);

  const identical = applyProportionalVariantWeights(variants, 'source');
  assert.equal(identical.error, null);
  assert.equal(identical.variants, variants);
  assert.deepEqual(identical.changedVariantIds, []);
  assert.deepEqual(identical.eligibleVariantIds, ['target']);
});

test('the Masa row exposes an adjacent accessible product action using the expanded variant', () => {
  const editorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
    ),
    'utf8'
  ).replace(/\r\n?/gu, '\n');
  const handlerStart = editorSource.indexOf(
    'const applyProportionalDimensionVariantWeights = () => {'
  );
  const handlerEnd = editorSource.indexOf(
    'const addQuantityDiscount = () => {',
    handlerStart
  );
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const handlerSource = editorSource.slice(handlerStart, handlerEnd);

  assert.match(editorSource, /bulkApplyRowKey === 'weight' \? \(/u);
  assert.match(editorSource, /data-testid="dimension-variant-proportional-mass"/u);
  assert.match(editorSource, /<span[\s\S]*?>\s*∏\s*<\/span>/u);
  assert.match(
    editorSource,
    /className="inline-flex !h-3\.5 !w-3\.5 shrink-0 items-center justify-center text-\[14px\] font-semibold leading-none"/u
  );
  assert.match(
    editorSource,
    /Izračunaj mase drugih različic po prostornini iz/u
  );
  assert.match(editorSource, /disabled=\{!canBulkApplyRow\}/u);
  assert.equal(
    editorSource.match(/className=\{dimensionVariantRowActionButtonClassName\}/gu)?.length,
    2
  );
  assert.match(handlerSource, /commitPendingDecimalDrafts\(\)/u);
  assert.match(handlerSource, /decimalCommit\.nextDraft\.variants/u);
  assert.match(handlerSource, /expandedDimensionVariantId/u);
  assert.match(handlerSource, /setDecimalInputDrafts\(\{\}\)/u);
  assert.doesNotMatch(handlerSource, /variantSelections/u);
});
