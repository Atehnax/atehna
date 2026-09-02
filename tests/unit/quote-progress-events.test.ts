import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminQuoteEvent } from '../../src/shared/domain/quote/quoteAdminTypes';
import {
  getQuoteProgressStatusLabel,
  isQuoteProgressEvent,
  selectQuoteProgressEvents
} from '../../src/admin/features/quotes/quoteProgressEvents';

const quoteEvent = (
  id: number,
  eventType: string,
  metadata: Record<string, unknown> | null = null
): AdminQuoteEvent => ({
  id,
  offerVersionId: null,
  eventType,
  actorType: 'admin',
  actorId: null,
  occurredAt: `2026-09-01T00:0${id}:00.000Z`,
  reason: null,
  metadata
});

test('quote progress keeps lifecycle milestones and excludes audit chatter', () => {
  for (const eventType of [
    'request_received',
    'draft_created',
    'offer_issued',
    'offer_viewed',
    'customer_purchase_order_uploaded',
    'admin_purchase_order_validated',
    'admin_purchase_order_rejected',
    'customer_accepted',
    'customer_declined',
    'offer_withdrawn',
    'offer_expired',
    'order_created',
    'request_closed_without_offer',
    'request_voided'
  ]) {
    assert.equal(isQuoteProgressEvent(quoteEvent(1, eventType)), true, eventType);
  }

  for (const eventType of [
    'draft_changed',
    'quote_request_details_changed',
    'clarification_requested',
    'preview_generated',
    'quote_email_queued',
    'quote_email_provider_accepted',
    'quote_email_provider_failed',
    'customer_acceptance_attempted',
    'acceptance_blocked_stock',
    'admin_document_uploaded'
  ]) {
    assert.equal(isQuoteProgressEvent(quoteEvent(1, eventType)), false, eventType);
  }
});

test('manual quote status changes are progress with destination-specific labels', () => {
  const received = quoteEvent(3, 'quote_request_details_changed', {
    changedFields: ['status'],
    statusChanged: true,
    previousStatus: 'in_preparation',
    nextStatus: 'received',
    manual: true
  });
  const inPreparation = quoteEvent(2, 'quote_request_details_changed', {
    changedFields: ['status'],
    statusChanged: true,
    previousStatus: 'received',
    nextStatus: 'in_preparation',
    manual: true
  });
  const plainDetailsEdit = quoteEvent(1, 'quote_request_details_changed', {
    changedFields: ['contactName'],
    statusChanged: false
  });
  const automaticCorrectionRevision = quoteEvent(4, 'quote_request_details_changed', {
    changedFields: ['customerType', 'status'],
    statusChanged: true,
    previousStatus: 'offer_issued',
    nextStatus: 'in_preparation',
    revisionCreated: true
  });

  assert.equal(isQuoteProgressEvent(received), true);
  assert.equal(getQuoteProgressStatusLabel(received), 'Prejeto');
  assert.equal(isQuoteProgressEvent(inPreparation), true);
  assert.equal(getQuoteProgressStatusLabel(inPreparation), 'V pripravi');
  assert.equal(isQuoteProgressEvent(plainDetailsEdit), false);
  assert.equal(getQuoteProgressStatusLabel(plainDetailsEdit), null);
  assert.equal(isQuoteProgressEvent(automaticCorrectionRevision), false);
  assert.equal(getQuoteProgressStatusLabel(automaticCorrectionRevision), null);
});

test('quote progress filters before its limit so recent chatter cannot hide milestones', () => {
  const events = [
    quoteEvent(9, 'quote_email_provider_accepted'),
    quoteEvent(8, 'draft_changed'),
    quoteEvent(7, 'quote_request_details_changed'),
    quoteEvent(6, 'preview_generated'),
    quoteEvent(5, 'offer_viewed'),
    quoteEvent(4, 'offer_issued'),
    quoteEvent(3, 'draft_created'),
    quoteEvent(2, 'request_received')
  ];

  assert.deepEqual(
    selectQuoteProgressEvents(events, 3).map((event) => event.id),
    [5, 4, 3]
  );
  assert.deepEqual(events.map((event) => event.id), [9, 8, 7, 6, 5, 4, 3, 2]);
});

test('replacement issuance contributes one compact progress milestone', () => {
  const replacementEvents = [
    quoteEvent(6, 'quote_email_queued'),
    quoteEvent(5, 'new_version_issued'),
    quoteEvent(4, 'offer_issued'),
    quoteEvent(3, 'offer_superseded'),
    quoteEvent(2, 'draft_created'),
    quoteEvent(1, 'request_received')
  ];

  assert.deepEqual(
    selectQuoteProgressEvents(replacementEvents).map((event) => event.eventType),
    ['offer_issued', 'draft_created', 'request_received']
  );
});

test('repeat views of the same issued offer consume one compact milestone', () => {
  const newestView = { ...quoteEvent(7, 'offer_viewed'), offerVersionId: 31 };
  const olderView = { ...quoteEvent(6, 'offer_viewed'), offerVersionId: 31 };
  const otherVersionView = { ...quoteEvent(5, 'offer_viewed'), offerVersionId: 30 };

  assert.deepEqual(
    selectQuoteProgressEvents([
      newestView,
      olderView,
      otherVersionView,
      quoteEvent(4, 'offer_issued'),
      quoteEvent(3, 'draft_created')
    ]).map((event) => event.id),
    [7, 5, 4, 3]
  );
});
