import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOrderEmailEventStatusPresentation,
  getQuoteEmailEventStatusPresentation
} from '../../src/admin/features/email/emailEventStatusPresentation';
import { ORDER_EMAIL_EVENT_DEFINITIONS } from '../../src/shared/domain/order/orderEmailSettings';
import { QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS } from '../../src/shared/domain/quote/quoteEmailSettings';

test('every order email event resolves to the canonical order status palette', () => {
  for (const definition of ORDER_EMAIL_EVENT_DEFINITIONS) {
    const presentation = getOrderEmailEventStatusPresentation(definition.value);
    assert.ok(presentation.rowClassName.includes('bg-'));
    assert.ok(presentation.rowClassName.includes('hover:!bg-'));
    assert.ok(presentation.sectionClassName.includes('/'));
  }

  assert.equal(
    getOrderEmailEventStatusPresentation('in_progress').tone,
    'warning'
  );
  assert.equal(
    getOrderEmailEventStatusPresentation('partially_sent').tone,
    'info'
  );
  assert.equal(
    getOrderEmailEventStatusPresentation('order_accepted').tone,
    'success'
  );
  assert.equal(
    getOrderEmailEventStatusPresentation('cancelled').tone,
    'danger'
  );
});

test('every quote email event resolves to the canonical quote status palette', () => {
  for (const definition of QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS) {
    const presentation = getQuoteEmailEventStatusPresentation(definition.value);
    assert.ok(presentation.rowClassName.includes('bg-'));
    assert.ok(presentation.rowClassName.includes('hover:!bg-'));
    assert.ok(presentation.sectionClassName.includes('/'));
  }

  assert.equal(
    getQuoteEmailEventStatusPresentation('quote_issued').tone,
    'info'
  );
  assert.equal(
    getQuoteEmailEventStatusPresentation('quote_accepted').tone,
    'success'
  );
  assert.equal(
    getQuoteEmailEventStatusPresentation('quote_declined').tone,
    'danger'
  );
  assert.equal(
    getQuoteEmailEventStatusPresentation('quote_expired').tone,
    'warning'
  );
  assert.match(
    getQuoteEmailEventStatusPresentation('quote_declined').rowClassName,
    /bg-rose-50/u
  );
  assert.match(
    getOrderEmailEventStatusPresentation('cancelled').rowClassName,
    /bg-orange-100/u
  );
});
