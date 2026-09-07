import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isNumericRangeActive, matchesNumericRange, validateNumericRange,
} from '@/shared/domain/pricingStock/numericFilters';

test('empty and whitespace-only numeric bounds impose no restriction', () => {
  const range = { min: '  ', max: '\t' };
  assert.equal(isNumericRangeActive(range), false);
  assert.equal(validateNumericRange(range), null);
  for (const value of [null, undefined, '', 'invalid', 0, -1, '123.45']) {
    assert.equal(matchesNumericRange(value, range), true);
  }
  assert.equal(isNumericRangeActive({ min: '0', max: '' }), true);
  assert.equal(isNumericRangeActive({ min: '', max: '0' }), true);
});

test('each one-sided range includes its boundary and leaves the other side unbounded', () => {
  const lower = { min: ' 2,50 ', max: '' };
  assert.equal(validateNumericRange(lower), null);
  for (const value of ['2.5', '2.5000', '9999999999.99']) {
    assert.equal(matchesNumericRange(value, lower), true);
  }
  assert.equal(matchesNumericRange('2.4999', lower), false);
  const upper = { min: '', max: '2.50' };
  for (const value of ['2,50', '-9999999999.99', 0]) {
    assert.equal(matchesNumericRange(value, upper), true);
  }
  assert.equal(matchesNumericRange('2.5001', upper), false);
});

test('two-sided ranges include both decimal boundaries and an exact single value', () => {
  const range = { min: '1,20', max: '2.30' };
  assert.equal(validateNumericRange(range), null);
  for (const value of ['1.2', '1.2000', '1.75', '2,3']) {
    assert.equal(matchesNumericRange(value, range), true);
  }
  for (const value of ['1.1999', '2.3001']) assert.equal(matchesNumericRange(value, range), false);
  assert.equal(validateNumericRange({ min: '2.00', max: '+2,0000' }), null);
  assert.equal(matchesNumericRange('2', { min: '2.00', max: '+2,0000' }), true);
});

test('negative RVC bounds and numeric inventory values compare without rounding', () => {
  const negative = { min: '-2,50', max: '-0.01' };
  assert.equal(validateNumericRange(negative), null);
  assert.equal(matchesNumericRange('-2.5000', negative), true);
  assert.equal(matchesNumericRange('-0,01', negative), true);
  assert.equal(matchesNumericRange(0, negative), false);
  assert.equal(matchesNumericRange('-2.5001', negative), false);
  for (const value of [-1, 0, 1]) assert.equal(matchesNumericRange(value, { min: '-1', max: '1' }), true);
  assert.equal(matchesNumericRange(2, { min: '-1', max: '1' }), false);
  assert.equal(matchesNumericRange('-0.00', { min: '0', max: '0' }), true);
});

test('decimal distinctions beyond binary-number precision stay distinct', () => {
  const large = { min: '9007199254740992.01', max: '9007199254740992.02' };
  assert.equal(validateNumericRange(large), null);
  assert.equal(matchesNumericRange('9007199254740992.01', large), true);
  assert.equal(matchesNumericRange('9007199254740992.02', large), true);
  assert.equal(matchesNumericRange('9007199254740992.00', large), false);
  assert.equal(matchesNumericRange('9007199254740992.03', large), false);
  const tiny = { min: '0.000000000001', max: '0.000000000002' };
  assert.equal(matchesNumericRange('0.000000000001', tiny), true);
  assert.equal(matchesNumericRange('0', tiny), false);
  assert.equal(matchesNumericRange('0.000000000003', tiny), false);
});

test('active ranges exclude unknown or invalid values while retaining explicit zero', () => {
  const range = { min: '0', max: '' };
  for (const value of [null, undefined, '', '  ', 'NaN', '1,2.3', Number.NaN, Infinity, -Infinity]) {
    assert.equal(matchesNumericRange(value, range), false);
  }
  for (const value of [0, '0', '0,00']) assert.equal(matchesNumericRange(value, range), true);
});

test('malformed bounds report the correct field and cannot accidentally match rows', () => {
  for (const invalid of ['.', '-', '1.', '.5', '1e3', '1 000', '1,000.00', 'NaN', 'Infinity', '0.0000000000001', '9'.repeat(81)]) {
    const lower = { min: invalid, max: '' }, upper = { min: '', max: invalid };
    assert.match(validateNumericRange(lower)!, /»Od«/u);
    assert.match(validateNumericRange(upper)!, /»Do«/u);
    assert.equal(isNumericRangeActive(lower), true);
    assert.equal(matchesNumericRange('1000', lower), false);
    assert.equal(matchesNumericRange('0', upper), false);
  }
});

test('reversed bounds are rejected even at large or very precise decimal values', () => {
  for (const range of [
    { min: '3', max: '2' }, { min: '-1', max: '-2' },
    { min: '9007199254740992.02', max: '9007199254740992.01' },
    { min: '0.000000000002', max: '0.000000000001' },
  ]) {
    assert.match(validateNumericRange(range)!, /»Od«.*večja.*»Do«/u);
    assert.equal(matchesNumericRange(range.min, range), false);
  }
});
