import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getQuoteRequestStatusLabel,
  getQuoteRequestStatusPresentation,
  getQuoteRequestVisibleStatusValue,
  isManuallyEditableQuoteRequestStatus,
  isQuoteRequestStatus,
  MANUALLY_EDITABLE_QUOTE_REQUEST_STATUSES,
  QUOTE_REQUEST_MANUAL_STATUS_OPTIONS,
  QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS
} from '../../src/shared/domain/quote/quoteRequestStatus';
import { QUOTE_REQUEST_STATUSES } from '../../src/shared/domain/quote/quoteTypes';

const expected = {
  received: ['Prejeto', 'neutral'],
  in_preparation: ['V pripravi', 'warning'],
  offer_issued: ['Izdano', 'info'],
  awaiting_purchase_order_review: ['Izdano', 'info'],
  accepted: ['Naročeno', 'success'],
  declined: ['Zavrnjeno', 'danger'],
  expired: ['Poteklo', 'warning'],
  withdrawn: ['Zavrnjeno', 'danger'],
  converted_to_order: ['Naročeno', 'success'],
  closed_without_offer: ['Zavrnjeno', 'danger']
} as const;

test('every request workflow status has one clear shared label, description, and tone', () => {
  assert.deepEqual([...QUOTE_REQUEST_STATUSES].sort(), Object.keys(expected).sort());

  for (const status of QUOTE_REQUEST_STATUSES) {
    const presentation = getQuoteRequestStatusPresentation(status);
    assert.equal(isQuoteRequestStatus(status), true);
    assert.equal(presentation.label, expected[status][0]);
    assert.equal(presentation.tone, expected[status][1]);
    assert.ok(presentation.description.length > 20);
    assert.equal(getQuoteRequestStatusLabel(status), presentation.label);
  }
});

test('offer-version statuses are not mistaken for request workflow statuses', () => {
  for (const offerStatus of ['draft', 'issued', 'superseded']) {
    assert.equal(isQuoteRequestStatus(offerStatus), false);
    assert.deepEqual(getQuoteRequestStatusPresentation(offerStatus), {
      label: 'Neznano',
      description: 'Status poteka ni prepoznan.',
      tone: 'neutral'
    });
  }
});

test('only pre-offer work statuses are available for manual editing', () => {
  assert.deepEqual(MANUALLY_EDITABLE_QUOTE_REQUEST_STATUSES, [
    'received',
    'in_preparation'
  ]);
  assert.deepEqual(QUOTE_REQUEST_MANUAL_STATUS_OPTIONS, [
    { value: 'received', label: 'Prejeto' },
    { value: 'in_preparation', label: 'V pripravi' }
  ]);

  for (const status of QUOTE_REQUEST_STATUSES) {
    assert.equal(
      isManuallyEditableQuoteRequestStatus(status),
      status === 'received' || status === 'in_preparation'
    );
  }
});
test('public request statuses use the complete table vocabulary and group internal workflow states', () => {
  assert.deepEqual(
    QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS.map(({ value, label }) => [value, label]),
    [
      ['preparation', 'V pripravi'],
      ['received', 'Prejeto'],
      ['issued', 'Izdano'],
      ['ordered', 'Naročeno'],
      ['declined', 'Zavrnjeno'],
      ['expired', 'Poteklo']
    ]
  );

  const groupedStatuses = QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS.flatMap(
    ({ statuses }) => statuses
  );
  assert.deepEqual([...groupedStatuses].sort(), [...QUOTE_REQUEST_STATUSES].sort());
  assert.equal(new Set(groupedStatuses).size, QUOTE_REQUEST_STATUSES.length);

  for (const option of QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS) {
    assert.equal(
      getQuoteRequestStatusLabel(option.presentationStatus),
      option.label
    );
    for (const status of option.statuses) {
      assert.equal(getQuoteRequestVisibleStatusValue(status), option.value);
    }
  }
  assert.equal(getQuoteRequestVisibleStatusValue('unknown'), null);
});