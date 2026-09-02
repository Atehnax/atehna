import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOrderEmailRetryEventCurrent,
  isRetryableOrderEmailFailure,
  orderEmailFailureCategory
} from '../../src/shared/domain/order/orderEmailRetryPolicy';

test('failed email retry accepts only explicit transient categories', () => {
  for (const category of [
    'network',
    'request_timeout',
    'too_early',
    'rate_limited',
    'server_error'
  ]) {
    assert.equal(isRetryableOrderEmailFailure(`[${category}] redacted`), true);
  }
  for (const failure of [
    '[permanent_http] rejected',
    '[invalid_payload] redacted',
    '[voided_order] removed',
    'unknown failure',
    null
  ]) {
    assert.equal(isRetryableOrderEmailFailure(failure), false);
  }
  assert.equal(orderEmailFailureCategory(' [network] timeout '), 'network');
});

test('failed email retry rejects lifecycle-stale events', () => {
  assert.equal(isOrderEmailRetryEventCurrent({
    eventType: 'in_progress',
    orderStatus: 'in_progress',
    contractStatus: 'accepted'
  }), true);
  assert.equal(isOrderEmailRetryEventCurrent({
    eventType: 'in_progress',
    orderStatus: 'sent',
    contractStatus: 'accepted'
  }), false);
  assert.equal(isOrderEmailRetryEventCurrent({
    eventType: 'order_submitted',
    orderStatus: 'received',
    contractStatus: 'pending_seller_acceptance'
  }), true);
  assert.equal(isOrderEmailRetryEventCurrent({
    eventType: 'order_submitted',
    orderStatus: 'in_progress',
    contractStatus: 'accepted'
  }), false);
  assert.equal(isOrderEmailRetryEventCurrent({
    eventType: 'order_accepted',
    orderStatus: 'sent',
    contractStatus: 'accepted'
  }), true);
  assert.equal(isOrderEmailRetryEventCurrent({
    eventType: 'order_rejected',
    orderStatus: 'received',
    contractStatus: 'rejected'
  }), true);
});
