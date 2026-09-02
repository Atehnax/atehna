import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneDefaultQuoteEmailSettings } from '@/shared/domain/quote/quoteEmailSettings';
import {
  getQuoteEmailRetryEligibility,
  type QuoteEmailRetryJobState
} from '@/shared/domain/quote/quoteEmailRetryEligibility';

const baseJob: QuoteEmailRetryJobState = {
  eventType: 'quote_request_submitted',
  audience: 'customer',
  recipientEmail: 'customer@example.test',
  requestStatus: 'received',
  requestVoided: false,
  offerVersionId: null,
  offerStatus: null,
  offerIsCurrent: false,
  hasNewerNonDraftOfferVersion: false,
  validUntil: null,
  currentCustomerEmail: 'customer@example.test',
  currentAdminRecipients: ['admin@example.test']
};

const eligibility = (
  patch: Partial<QuoteEmailRetryJobState> = {},
  options: { delivery?: boolean; enabled?: boolean; now?: number } = {}
) => {
  const settings = cloneDefaultQuoteEmailSettings();
  settings.enabled = options.enabled ?? true;
  return getQuoteEmailRetryEligibility({
    job: { ...baseJob, ...patch },
    settings,
    emailDeliveryEnabled: options.delivery ?? true,
    now: options.now
  });
};

test('eligible failed business email remains retryable', () => {
  assert.deepEqual(eligibility(), {
    retryEligible: true,
    retryIneligibleReason: null
  });
});

test('guaranteed-dead system jobs never expose retry', () => {
  assert.equal(
    eligibility({ eventType: 'quote_access_otp' }).retryEligible,
    false
  );
  assert.equal(
    eligibility({
      eventType: 'quote_delivery_failed',
      audience: 'admin',
      recipientEmail: 'admin@example.test'
    }).retryEligible,
    false
  );
});

test('disabled delivery, master, or event audience suppress retry', () => {
  assert.equal(eligibility({}, { delivery: false }).retryEligible, false);
  assert.equal(eligibility({}, { enabled: false }).retryEligible, false);

  const settings = cloneDefaultQuoteEmailSettings();
  settings.events.quote_request_submitted.customer = false;
  assert.equal(
    getQuoteEmailRetryEligibility({
      job: baseJob,
      settings,
      emailDeliveryEnabled: true
    }).retryEligible,
    false
  );
});

test('stale recipients and obsolete lifecycle state suppress retry', () => {
  assert.equal(
    eligibility({ currentCustomerEmail: 'corrected@example.test' }).retryEligible,
    false
  );
  assert.equal(
    eligibility({ requestStatus: 'accepted' }).retryEligible,
    false
  );
  assert.equal(
    eligibility({
      audience: 'admin',
      recipientEmail: 'old-admin@example.test'
    }).retryEligible,
    false
  );
});

test('terminal offer email allows preparation drafts but rejects advanced lifecycle state', () => {
  for (const [eventType, offerStatus] of [
    ['quote_withdrawn', 'withdrawn'],
    ['quote_expired', 'expired']
  ] as const) {
    const terminalJob = {
      eventType,
      offerVersionId: 41,
      offerStatus,
      offerIsCurrent: false,
      requestStatus: offerStatus
    };
    assert.equal(eligibility(terminalJob).retryEligible, true);
    assert.equal(
      eligibility({
        ...terminalJob,
        requestStatus: 'in_preparation'
      }).retryEligible,
      true
    );
    assert.equal(
      eligibility({
        ...terminalJob,
        requestStatus: 'in_preparation',
        hasNewerNonDraftOfferVersion: true
      }).retryEligible,
      false
    );
    assert.equal(
      eligibility({
        ...terminalJob,
        requestStatus: 'offer_issued'
      }).retryEligible,
      false
    );
  }
});

test('issued and stock-blocked emails both require a current unexpired issued offer', () => {
  const now = Date.parse('2029-01-01T00:00:00.000Z');
  const currentIssuedOffer = {
    requestStatus: 'offer_issued',
    offerVersionId: 42,
    offerStatus: 'issued',
    offerIsCurrent: true,
    validUntil: '2030-01-01T00:00:00.000Z'
  };

  for (const eventType of [
    'quote_issued',
    'quote_acceptance_blocked_stock'
  ] as const) {
    assert.equal(
      eligibility({ ...currentIssuedOffer, eventType }, { now }).retryEligible,
      true
    );
    assert.equal(
      eligibility(
        { ...currentIssuedOffer, eventType, offerIsCurrent: false },
        { now }
      ).retryEligible,
      false
    );
    assert.equal(
      eligibility(
        {
          ...currentIssuedOffer,
          eventType,
          validUntil: '2028-01-01T00:00:00.000Z'
        },
        { now }
      ).retryEligible,
      false
    );
  }
});
