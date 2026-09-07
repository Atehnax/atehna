import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eur,
  numeric,
  percent,
  formatAnalyticsCalendarDay,
  formatAnalyticsRecordDate
} from '../../src/admin/features/analitika/lib/formatting';

const minusSign = new Intl.NumberFormat('sl-SI').formatToParts(-1).find(part => part.type === 'minusSign')!.value;

test('analytics distinguishes missing or non-finite observations from zero', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity]) {
    assert.equal(eur(value), '—');
    assert.equal(numeric(value), '—');
    assert.equal(percent(value), '—');
  }
  assert.equal(eur(0), '0,00\u00a0€');
  assert.equal(eur(-0), minusSign + '0,00\u00a0€');
  assert.equal(numeric(0), '0');
  assert.equal(numeric(-0), minusSign + '0');
  assert.equal(percent(0), '0 %');
  assert.equal(percent(Number.MAX_VALUE), '—');
});

test('analytics retains Slovenian rounding, grouping, currency spacing and percentage units', () => {
  assert.equal(eur(-12345.567), minusSign + '12.345,57\u00a0€');
  assert.equal(numeric(12345.567), '12.345,57');
  assert.equal(numeric(-12345.567, 1), minusSign + '12.345,6');
  assert.equal(numeric(12345.567, 0), '12.346');
  assert.equal(numeric(0.123456, 4), '0,1235');
  assert.equal(percent(-0.123456), minusSign + '12,3 %');
  assert.equal(percent(1.005), '100,5 %');
});

test('cached formatters preserve all supported precisions and prior Intl option errors', () => {
  const values = [-Number.MAX_VALUE, -12345.6789, -0.00001, -0, 0, 0.00001, 1.235, 12345.6789, Number.MAX_VALUE];
  for (const value of values) {
    assert.equal(eur(value), new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value));
    for (const digits of [0, 1, 2, 4, 20, 1.5]) {
      const expected = new Intl.NumberFormat('sl-SI', { maximumFractionDigits: digits }).format(value);
      assert.equal(numeric(value, digits), expected);
      assert.equal(numeric(value, digits), expected);
    }
  }
  for (const digits of [-1, 101, NaN, Infinity]) assert.throws(() => numeric(1, digits), RangeError);
  assert.equal(numeric(null, -1), '—');
});

test('calendar labels keep UTC dates and record labels use Ljubljana day boundaries', () => {
  const calendar = new Intl.DateTimeFormat('sl-SI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  for (const date of ['2024-02-29', '2026-03-29', '2026-10-25', '2026-12-31']) {
    assert.equal(formatAnalyticsCalendarDay(date), calendar.format(new Date(date + 'T12:00:00Z')));
  }
  const recordDate = new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', dateStyle: 'medium' });
  for (const date of ['2026-01-01T23:30:00Z', '2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z']) {
    assert.equal(formatAnalyticsRecordDate(date), recordDate.format(new Date(date)));
    assert.equal(formatAnalyticsRecordDate(new Date(date).getTime()), recordDate.format(new Date(date)));
  }
  assert.equal(formatAnalyticsRecordDate('2026-01-01T23:30:00Z'), formatAnalyticsRecordDate('2026-01-02T12:00:00Z'));
  assert.throws(() => formatAnalyticsCalendarDay('invalid'), RangeError);
  assert.throws(() => formatAnalyticsRecordDate('invalid'), RangeError);
});
