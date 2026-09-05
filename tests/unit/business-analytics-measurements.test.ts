import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalyticsMeasurementValidationError, parseAnalyticsMeasurementMutation } from '@/shared/domain/analytics/measurements';

const parse = (fields: Record<string, unknown>) => parseAnalyticsMeasurementMutation({ expectedRevision: 0, reason: 'Račun prevoznika 2026-009', fields });

test('actual measurements retain missing values and exact decimal money independently of checkout parcels', () => {
  const result = parse({ actualPackedWeightGrams: '', actualCarrierCostNet: '4,19', actualParcelCount: null, preparationMinutes: '0', actualOversize: false });
  assert.deepEqual(result.fields, { actualPackedWeightGrams: null, actualCarrierCostNet: '4.19', actualParcelCount: null, preparationMinutes: '0.00', actualOversize: false });
});

test('negative, fractional count, nonfinite, excessive precision and out of range data are rejected', () => {
  for (const fields of [
    { actualCarrierCostNet: '-1' }, { actualCarrierCostNet: '1.001' },
    { actualCarrierCostNet: '10000000000' }, { actualPackedWeightGrams: 0 },
    { actualPackedWeightGrams: 1.3 }, { actualParcelCount: Infinity },
    { preparationMinutes: 'NaN' }, { preparationMinutes: -1 },
    { shippingTaxRate: '1.0001' }, { actualOversize: 'yes' }
  ]) assert.throws(() => parse(fields), AnalyticsMeasurementValidationError);
});

test('refund completeness requires an explicit amount, and zero remains a known measurement', () => {
  assert.throws(() => parse({ merchandiseRefundNet: null, refundHistoryComplete: true }), AnalyticsMeasurementValidationError);
  assert.deepEqual(parse({ merchandiseRefundNet: '0', refundHistoryComplete: true }).fields, { merchandiseRefundNet: '0.00', refundHistoryComplete: true });
  assert.deepEqual(parse({ merchandiseRefundNet: null, refundHistoryComplete: false }).fields, { merchandiseRefundNet: null, refundHistoryComplete: false });
});

test('audit revision, evidence and supported fields are required; prototype property names do not bypass the allowlist', () => {
  for (const input of [
    { expectedRevision: -1, reason: 'vir', fields: { preparationMinutes: 1 } },
    { expectedRevision: 0, reason: '', fields: { preparationMinutes: 1 } },
    { expectedRevision: 0, reason: 'vir', fields: {} },
    { expectedRevision: 0, reason: 'vir', fields: { subtotal: 0 } },
    { expectedRevision: 0, reason: 'vir', fields: { toString: 'oops' } }
  ]) assert.throws(() => parseAnalyticsMeasurementMutation(input), AnalyticsMeasurementValidationError);
});
