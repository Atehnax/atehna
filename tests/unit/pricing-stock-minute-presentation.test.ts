import assert from 'node:assert/strict';
import test from 'node:test';
import { workMinutesText, workMinutesTitle } from '@/admin/features/artikli/components/pricing-stock/viewHelpers';
import { calculatePricingStockRow, createDefaultPricingStockModel, parsePricingStockPaste, previewPricingStockColumn } from '@/shared/domain/pricingStock';

const row = (variantId: number, workMinutes: string | null) => ({
  variantId, itemId: 10, unit: 'kos', inventory: 2, purchaseNet: '2.00', saleNet: '5.00',
  workMinutes, otherCosts: '0.00',
});

test('whole-minute presentation removes canonical padding, keeping missing distinct from zero', () => {
  for (const value of [null, undefined, '', '  ']) assert.equal(workMinutesText(value), '');
  assert.equal(workMinutesText('0.0000'), '0');
  assert.equal(workMinutesText('6.0000'), '6');
  assert.equal(workMinutesText('24,0000'), '24');
  assert.equal(workMinutesText(12), '12');
});

test('fractional minutes round only for display using exact decimal boundaries', () => {
  assert.equal(workMinutesText('6.4999'), '6');
  assert.equal(workMinutesText('6.5000'), '7');
  assert.equal(workMinutesText('0.0001'), '0');
  assert.equal(workMinutesText('99999999.9999'), '100000000');
  assert.match(workMinutesTitle('6.5000'), /izračun uporablja 6,5 min/u);
  assert.match(workMinutesTitle('0.0001'), /izračun uporablja 0,0001 min/u);
  assert.doesNotMatch(workMinutesTitle('6.0000'), /zaokrožen|6,0000/u);
});

test('malformed drafts are not silently converted into valid whole-minute values', () => {
  for (const draft of ['ni število', '1,', '1.2.3']) assert.equal(workMinutesText(draft), draft.replace('.', ','));
});

test('paste and source-copy values display without padding while retaining exact calculations', () => {
  const parsed = parsePricingStockPaste('6,5000\n24\n', ['workMinutes']);
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.rows.map(value => workMinutesText(value.workMinutes)), ['7', '24']);
  assert.equal(parsed.rows[0].workMinutes, '6.5000');
  const source = row(1, parsed.rows[0].workMinutes!);
  const target = row(2, '1.0000');
  const copy = previewPricingStockColumn(source, [target], 'workMinutes', 'copy');
  assert.equal(copy.rows[0].proposed, '6.5000');
  assert.equal(workMinutesText(copy.rows[0].proposed), '7');
  assert.equal(copy.rows[0].proposed, source.workMinutes);
  const model = {...createDefaultPricingStockModel(), formula: 'čas_artikla_v_minutah'};
  const exactResult = calculatePricingStockRow(source, model);
  workMinutesText(source.workMinutes);
  assert.deepEqual(calculatePricingStockRow(source, model), exactResult);
  assert.equal(exactResult.targetRvc, '6.50');
  assert.equal(target.workMinutes, '1.0000');
});
