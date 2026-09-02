import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildQuoteRequestStatusSelectionOptions,
  getManualQuoteRequestStatusTarget,
  QUOTE_REQUEST_MANUAL_STATUS_TARGET_BY_VISIBLE_VALUE
} from '../../src/admin/features/quotes/quoteStatusSelection';
import {
  QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS,
  type QuoteRequestVisibleStatusValue
} from '../../src/shared/domain/quote/quoteRequestStatus';

const option = (
  options: ReturnType<typeof buildQuoteRequestStatusSelectionOptions>,
  value: QuoteRequestVisibleStatusValue
) => {
  const found = options.find((candidate) => candidate.value === value);
  assert.ok(found, `Missing visible quote status option: ${value}`);
  return found;
};

test('status selection preserves the shared six-option order and presentation statuses', () => {
  const options = buildQuoteRequestStatusSelectionOptions({
    currentStatus: 'received',
    hasIssuedOfferHistory: false,
    hasDraft: false
  });

  assert.deepEqual(
    options.map(({ value, label, presentationStatus }) => ({
      value,
      label,
      presentationStatus
    })),
    QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS.map(
      ({ value, label, presentationStatus }) => ({
        value,
        label,
        presentationStatus
      })
    )
  );
  assert.equal(options.length, 6);
  assert.equal(options.every(({ description }) => description.length > 0), true);
});

test('only received and preparation are selectable before issued history', () => {
  const options = buildQuoteRequestStatusSelectionOptions({
    currentStatus: 'received',
    hasIssuedOfferHistory: false,
    hasDraft: false
  });

  assert.equal(option(options, 'received').disabled, false);
  assert.equal(option(options, 'preparation').disabled, false);
  for (const value of ['issued', 'ordered', 'declined', 'expired'] as const) {
    assert.equal(option(options, value).disabled, true);
  }
  assert.match(option(options, 'issued').description, /Najprej pripravite osnutek/u);
  assert.match(option(options, 'issued').description, /Izdaj ponudbo/u);
  assert.match(option(options, 'ordered').description, /sprejemom stranke/u);
  assert.match(option(options, 'ordered').description, /potrditvijo naročilnice/u);
  assert.match(option(options, 'declined').description, /Zaključi brez izdaje ponudbe/u);
  assert.match(option(options, 'expired').description, /samodejno/u);
});

test('a prepared draft points the blocked issued option at the issue button', () => {
  const options = buildQuoteRequestStatusSelectionOptions({
    currentStatus: 'in_preparation',
    hasIssuedOfferHistory: false,
    hasDraft: true
  });

  assert.equal(option(options, 'preparation').disabled, false);
  assert.equal(option(options, 'received').disabled, false);
  assert.equal(option(options, 'issued').disabled, true);
  assert.equal(
    option(options, 'issued').description,
    'Ponudbo izdajte z gumbom »Izdaj ponudbo«.'
  );
});

test('issued history blocks manual reversal while keeping the current group available', () => {
  const options = buildQuoteRequestStatusSelectionOptions({
    currentStatus: 'in_preparation',
    hasIssuedOfferHistory: true,
    hasDraft: true
  });

  assert.equal(option(options, 'preparation').disabled, false);
  assert.equal(option(options, 'received').disabled, true);
  assert.match(option(options, 'received').description, /obstoječim osnutkom/u);
  assert.match(option(options, 'received').description, /Izdaj ponudbo/u);
});

test('each lifecycle-owned raw status keeps its grouped current option enabled', () => {
  const cases = [
    ['awaiting_purchase_order_review', 'issued'],
    ['converted_to_order', 'ordered'],
    ['withdrawn', 'declined'],
    ['expired', 'expired']
  ] as const;

  for (const [currentStatus, currentValue] of cases) {
    const options = buildQuoteRequestStatusSelectionOptions({
      currentStatus,
      hasIssuedOfferHistory: true,
      hasDraft: false
    });
    assert.equal(option(options, currentValue).disabled, false);
    assert.match(option(options, currentValue).description, /Trenutno stanje/u);
    assert.equal(option(options, 'received').disabled, true);
    assert.equal(option(options, 'preparation').disabled, true);
  }
});

test('a closed request cannot be reopened manually even without issued history', () => {
  const options = buildQuoteRequestStatusSelectionOptions({
    currentStatus: 'closed_without_offer',
    hasIssuedOfferHistory: false,
    hasDraft: true
  });

  assert.equal(option(options, 'declined').disabled, false);
  assert.equal(option(options, 'received').disabled, true);
  assert.equal(option(options, 'preparation').disabled, true);
  assert.match(
    option(options, 'received').description,
    /ni mogoče znova odpreti/u
  );
});

test('purchase-order review explains the review action before every conflicting transition', () => {
  const options = buildQuoteRequestStatusSelectionOptions({
    currentStatus: 'awaiting_purchase_order_review',
    hasIssuedOfferHistory: true,
    hasDraft: false
  });

  assert.match(option(options, 'preparation').description, /potrdite ali zavrnite naročilnico/u);
  assert.match(option(options, 'received').description, /potrdite ali zavrnite naročilnico/u);
  assert.match(option(options, 'ordered').description, /potrdite/u);
  assert.match(option(options, 'declined').description, /zavrnite/u);
});

test('issued history never recommends the pre-issue close action', () => {
  const options = buildQuoteRequestStatusSelectionOptions({
    currentStatus: 'in_preparation',
    hasIssuedOfferHistory: true,
    hasDraft: true
  });

  assert.doesNotMatch(option(options, 'declined').description, /Zaključi brez izdaje ponudbe/u);
});

test('visible manual targets map to the only two raw mutable statuses', () => {
  assert.deepEqual(QUOTE_REQUEST_MANUAL_STATUS_TARGET_BY_VISIBLE_VALUE, {
    preparation: 'in_preparation',
    received: 'received'
  });
  assert.equal(
    getManualQuoteRequestStatusTarget('preparation'),
    'in_preparation'
  );
  assert.equal(getManualQuoteRequestStatusTarget('received'), 'received');
  assert.equal(getManualQuoteRequestStatusTarget('issued'), null);
  assert.equal(getManualQuoteRequestStatusTarget('ordered'), null);
  assert.equal(getManualQuoteRequestStatusTarget('declined'), null);
  assert.equal(getManualQuoteRequestStatusTarget('expired'), null);
});
