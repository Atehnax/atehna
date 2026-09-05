import {
  QUOTE_EMAIL_EVENT_TYPES,
  type QuoteEmailEventType,
  type QuoteEmailSettings
} from '@/shared/domain/quote/quoteEmailSettings';

export type QuoteEmailRetryEligibility = {
  retryEligible: boolean;
  retryIneligibleReason: string | null;
};

export type QuoteEmailRetryJobState = {
  eventType: string;
  audience: string;
  recipientEmail: string;
  requestStatus: string;
  requestVoided: boolean;
  offerVersionId: number | null;
  offerStatus: string | null;
  offerIsCurrent: boolean;
  hasNewerNonDraftOfferVersion: boolean;
  validUntil: string | null;
  currentCustomerEmail?: string | null;
  currentAdminRecipients?: readonly string[];
};

const ineligible = (reason: string): QuoteEmailRetryEligibility => ({
  retryEligible: false,
  retryIneligibleReason: reason
});

const normalizedEmail = (value: string | null | undefined) =>
  String(value ?? '').trim().toLowerCase();

export function quoteEmailRetryStateIsCurrent(
  job: QuoteEmailRetryJobState,
  now = Date.now()
): boolean {
  const eventType = job.eventType;
  if (eventType === 'quote_access_otp' || eventType === 'quote_delivery_failed') {
    return false;
  }
  if (eventType === 'quote_issued' || eventType === 'quote_acceptance_blocked_stock') {
    return job.offerStatus === 'issued' &&
      job.offerIsCurrent &&
      new Date(job.validUntil ?? '').getTime() > now;
  }
  if (eventType === 'quote_accepted') return job.offerStatus === 'accepted';
  if (eventType === 'quote_declined') return job.offerStatus === 'declined';
  if (eventType === 'quote_withdrawn') {
    return job.offerStatus === 'withdrawn' &&
      ['withdrawn', 'in_preparation'].includes(job.requestStatus) &&
      !job.hasNewerNonDraftOfferVersion;
  }
  if (eventType === 'quote_expired') {
    return job.offerStatus === 'expired' &&
      ['expired', 'in_preparation'].includes(job.requestStatus) &&
      !job.hasNewerNonDraftOfferVersion;
  }
  if (eventType === 'quote_request_closed') {
    return job.requestStatus === 'closed_without_offer';
  }
  if (eventType === 'quote_clarification_requested') {
    if (![
      'received',
      'in_preparation',
      'offer_issued',
      'awaiting_purchase_order_review'
    ].includes(job.requestStatus)) return false;
    if (job.offerVersionId === null) return true;
    return job.offerStatus === 'draft' ||
      (job.offerStatus === 'issued' && job.offerIsCurrent);
  }
  return eventType === 'quote_request_submitted' &&
    ['received', 'in_preparation', 'offer_issued'].includes(job.requestStatus);
}

export function getQuoteEmailRetryEligibility(input: {
  job: QuoteEmailRetryJobState;
  settings: QuoteEmailSettings;
  now?: number;
}): QuoteEmailRetryEligibility {
  const { job, settings } = input;
  if (job.eventType === 'quote_access_otp') {
    return ineligible('Varnostne kode ni mogoče ponoviti; stranka naj zahteva novo kodo.');
  }
  if (job.eventType === 'quote_delivery_failed') {
    return ineligible('Sistemskega obvestila o napaki ni mogoče ponovno poslati.');
  }
  if (!QUOTE_EMAIL_EVENT_TYPES.includes(job.eventType as QuoteEmailEventType)) {
    return ineligible('Ta vrsta e-pošte ni več podprta.');
  }
  if (job.requestVoided) {
    return ineligible('Povpraševanje je odstranjeno.');
  }
  if (!quoteEmailRetryStateIsCurrent(job, input.now)) {
    return ineligible('Sporočilo ne ustreza več trenutnemu stanju ponudbe.');
  }
  const eventType = job.eventType as QuoteEmailEventType;
  const audienceEnabled = job.audience === 'customer'
    ? settings.events[eventType].customer
    : job.audience === 'admin'
      ? settings.events[eventType].admins
      : false;
  if (!settings.enabled || !audienceEnabled) {
    return ineligible('Pošiljanje tega obvestila je v nastavitvah izključeno.');
  }
  const recipient = normalizedEmail(job.recipientEmail);
  if (
    job.audience === 'customer' &&
    job.currentCustomerEmail !== undefined &&
    recipient !== normalizedEmail(job.currentCustomerEmail)
  ) {
    return ineligible('E-poštni naslov stranke se je po neuspelem pošiljanju spremenil.');
  }
  if (
    job.audience === 'admin' &&
    job.currentAdminRecipients &&
    !job.currentAdminRecipients.some((value) => normalizedEmail(value) === recipient)
  ) {
    return ineligible('Prejemnik ni več med administratorskimi prejemniki.');
  }
  return { retryEligible: true, retryIneligibleReason: null };
}
