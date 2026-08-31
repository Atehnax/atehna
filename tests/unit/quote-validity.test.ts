import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addOneCalendarMonth,
  defaultQuoteValidityDateInput
} from '../../src/shared/domain/quote/quoteValidity';

test('quote validity is one exact calendar month after its anchor', () => {
  assert.equal(
    defaultQuoteValidityDateInput('2026-08-30T19:14:00.000Z'),
    '2026-09-30'
  );
  assert.equal(
    addOneCalendarMonth('2026-12-15T08:30:45.000Z')?.toISOString(),
    '2027-01-15T08:30:45.000Z'
  );
});

test('quote validity clamps month-end dates and rejects invalid anchors', () => {
  assert.equal(
    defaultQuoteValidityDateInput('2027-01-31T10:00:00.000Z'),
    '2027-02-28'
  );
  assert.equal(
    defaultQuoteValidityDateInput('2028-01-31T10:00:00.000Z'),
    '2028-02-29'
  );
  assert.equal(defaultQuoteValidityDateInput('not-a-date'), '');
});
