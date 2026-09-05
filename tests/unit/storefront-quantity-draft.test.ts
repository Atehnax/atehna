import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_STOREFRONT_QUANTITY,
  parseStorefrontQuantityDraft,
  validateStorefrontQuantityDraft
} from '@/commercial/quantity/quantityDraft';

test('quantity drafts parse whole numbers without rewriting intermediate input', () => {
  assert.equal(parseStorefrontQuantityDraft('1'), 1);
  assert.equal(parseStorefrontQuantityDraft('15'), 15);
  assert.equal(parseStorefrontQuantityDraft(' 0005 '), 5);

  for (const draft of ['', ' ', '-', '1.', '1,5', '1e2', 'abc']) {
    assert.equal(parseStorefrontQuantityDraft(draft), null, draft);
  }
});

test('minimum quantities are checked on validation instead of being clamped', () => {
  assert.deepEqual(validateStorefrontQuantityDraft('1', { minimum: 5 }), {
    valid: false,
    code: 'below-minimum',
    message: 'Najmanjša količina je 5.'
  });
  assert.deepEqual(validateStorefrontQuantityDraft('15', { minimum: 5 }), {
    valid: true,
    quantity: 15
  });
});

test('empty, non-positive, fractional, and excessive submissions return errors', () => {
  assert.deepEqual(validateStorefrontQuantityDraft(''), {
    valid: false,
    code: 'required',
    message: 'Vnesite količino.'
  });
  assert.deepEqual(validateStorefrontQuantityDraft('0'), {
    valid: false,
    code: 'invalid',
    message: 'Količina mora biti pozitivno celo število.'
  });
  assert.deepEqual(validateStorefrontQuantityDraft('2.5'), {
    valid: false,
    code: 'invalid',
    message: 'Količina mora biti pozitivno celo število.'
  });
  assert.deepEqual(
    validateStorefrontQuantityDraft(String(MAX_STOREFRONT_QUANTITY + 1)),
    {
      valid: false,
      code: 'above-maximum',
      message: `Največja dovoljena količina je ${MAX_STOREFRONT_QUANTITY}.`
    }
  );
});

test('an available-stock maximum is reported without changing the submitted value', () => {
  assert.deepEqual(
    validateStorefrontQuantityDraft('16', { minimum: 5, maximum: 15 }),
    {
      valid: false,
      code: 'above-maximum',
      message: 'Največja dovoljena količina je 15.'
    }
  );
  assert.deepEqual(
    validateStorefrontQuantityDraft('15', { minimum: 5, maximum: 15 }),
    { valid: true, quantity: 15 }
  );
});
