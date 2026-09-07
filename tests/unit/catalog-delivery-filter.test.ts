import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchesCatalogDeliveryRange as matches,
  validateCatalogDeliveryRange as validate,
} from '@/shared/domain/catalog/catalogDeliveryFilter';

const days = (min = '', max = '') => ({ min, max });

test('an inactive delivery filter accepts missing, unknown and numeric estimates', () => {
  assert.equal(validate(days()), null);
  for (const value of [null, undefined, '', 'po dogovoru', '2–4 d']) {
    assert.equal(matches(value, days()), true);
    assert.equal(matches(value, days(' ', '\t')), true);
  }
});

test('a bounded day filter includes delivery intervals that overlap either inclusive edge', () => {
  for (const value of ['2–4 d', '1 d', '5 d', '0–1 d', '5–7 d', '0–8 d']) {
    assert.equal(matches(value, days('1', '5')), true, value);
  }
  for (const value of ['0 d', '6 d', '6–8 d']) {
    assert.equal(matches(value, days('1', '5')), false, value);
  }
  assert.equal(matches('2–4 d', days('4', '6')), true);
});

test('a single field filters one exact day and includes estimates containing that day', () => {
  for (const range of [days('3'), days('', '3'), days('3', '3')]) {
    assert.equal(validate(range), null);
    for (const value of ['3 d', '2–4 d', '0–3 d', '3–8 d']) assert.equal(matches(value, range), true, value);
    for (const value of ['2 d', '4 d', '0–2 d', '4–8 d']) assert.equal(matches(value, range), false, value);
  }
  assert.equal(matches('2–4 d', days('5')), false);
});

test('zero days, whitespace and leading zeroes remain valid exact quantities', () => {
  assert.equal(validate(days(' 00 ', '02')), null);
  assert.equal(matches('0 dni', days('0')), true);
  assert.equal(matches('0–2 d', days('', '0')), true);
  assert.equal(matches('1 d', days('0')), false);
  assert.equal(matches('02—04 DELOVNI DNEVI', days(' 03 ')), true);
});

test('supported Slovenian day labels and dash variants use the same day parser as the table', () => {
  for (const value of ['2-4', '2 – 4 dni', '2—4 delovne dni', '2-4 koledarske dni', '2 delovna dneva', '3 delovni dnevi', '4 delovnih dni']) {
    assert.equal(matches(value, days('1', '5')), true, value);
  }
  assert.equal(matches('1 delovni dan', days('1')), true);
  assert.equal(matches('4-4 dni', days('4')), true);
});

test('unknown estimates, dates and units other than days never match an active filter', () => {
  for (const value of [null, undefined, '', ' ', '—', 'po dogovoru', 'na zalogi', 'do 4 dni', '2-4 tedne', '24 ur', '2026-09-06', '4. 9. 2026', '4/9', '4 dni od naročila']) {
    assert.equal(matches(value, days('0', '9999')), false, String(value));
  }
});

test('fractional, negative, reversed and malformed stored estimates do not match', () => {
  for (const value of ['-1 dni', '-1-2 dni', '4-2 dni', '1.5 dni', '1,5 dni', '1e2 dni', '2- dni', '2-4-6 dni', '0'.repeat(81)]) {
    assert.equal(matches(value, days('0', '9999')), false, value);
  }
});

test('filters require nonnegative whole safe integers in either field', () => {
  for (const value of ['-1', '-0', '1.5', '1,5', '+2', '1e2', 'Infinity', 'NaN', '3 d', '0x10', '2 000', '9007199254740992', '9'.repeat(500)]) {
    for (const range of [days(value), days('', value)]) {
      assert.notEqual(validate(range), null, value);
      assert.equal(matches('2–4 d', range), false, value);
      assert.equal(matches(null, range), false, value);
    }
  }
});

test('a reversed filter reports the standard range error and never widens results', () => {
  const range = days('5', '1');
  assert.equal(validate(range), 'Vrednost »Od« ne sme biti večja od vrednosti »Do«.');
  assert.equal(matches('2–4 d', range), false);
  assert.equal(matches('0–8 d', range), false);
});

test('safe integer boundaries compare without rounding oversized stored day values', () => {
  const max = String(Number.MAX_SAFE_INTEGER);
  assert.equal(validate(days(max)), null);
  assert.equal(matches(max + ' d', days(max)), true);
  assert.equal(matches('9007199254740992 d', days(max)), false);
  assert.equal(matches('1–9007199254740992 d', days('1')), false);
  assert.equal(matches('9'.repeat(70) + ' d', days('1')), false);
});
