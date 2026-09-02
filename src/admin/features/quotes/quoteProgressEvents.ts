import type { AdminQuoteEvent } from '@/shared/domain/quote/quoteAdminTypes';

const QUOTE_PROGRESS_EVENT_TYPES = new Set([
  'request_received',
  'quote_request_received',
  'draft_created',
  'offer_draft_created',
  'offer_issued',
  'offer_viewed',
  'customer_purchase_order_uploaded',
  'purchase_order_submitted',
  'admin_purchase_order_validated',
  'purchase_order_validated',
  'admin_purchase_order_rejected',
  'purchase_order_rejected',
  'customer_accepted',
  'customer_declined',
  'offer_withdrawn',
  'offer_expired',
  'order_created',
  'request_closed_without_offer',
  'quote_request_closed',
  'request_voided'
]);

const MANUAL_QUOTE_PROGRESS_STATUS_LABELS = {
  received: 'Prejeto',
  in_preparation: 'V pripravi'
} as const;

type ManualQuoteProgressStatus =
  keyof typeof MANUAL_QUOTE_PROGRESS_STATUS_LABELS;

const getManualQuoteProgressStatus = (
  event: AdminQuoteEvent
): ManualQuoteProgressStatus | null => {
  if (
    event.eventType !== 'quote_request_details_changed' ||
    event.metadata?.statusChanged !== true ||
    event.metadata.manual !== true
  ) {
    return null;
  }

  const nextStatus = event.metadata.nextStatus;
  return typeof nextStatus === 'string' &&
    Object.prototype.hasOwnProperty.call(
      MANUAL_QUOTE_PROGRESS_STATUS_LABELS,
      nextStatus
    )
    ? nextStatus as ManualQuoteProgressStatus
    : null;
};

export const getQuoteProgressStatusLabel = (
  event: AdminQuoteEvent
): string | null => {
  const status = getManualQuoteProgressStatus(event);
  return status ? MANUAL_QUOTE_PROGRESS_STATUS_LABELS[status] : null;
};

export const isQuoteProgressEvent = (event: AdminQuoteEvent): boolean =>
  QUOTE_PROGRESS_EVENT_TYPES.has(event.eventType) ||
  getManualQuoteProgressStatus(event) !== null;

export const selectQuoteProgressEvents = (
  events: readonly AdminQuoteEvent[],
  limit = 5
): AdminQuoteEvent[] => {
  const maximum = Math.max(0, limit);
  if (maximum === 0) return [];
  const selected: AdminQuoteEvent[] = [];
  const viewedOfferVersions = new Set<string>();

  for (const event of events) {
    if (!isQuoteProgressEvent(event)) continue;
    if (event.eventType === 'offer_viewed') {
      const offerVersionKey = String(
        event.offerVersionId ?? event.metadata?.offerVersionId ?? event.id
      );
      if (viewedOfferVersions.has(offerVersionKey)) continue;
      viewedOfferVersions.add(offerVersionKey);
    }
    selected.push(event);
    if (selected.length >= maximum) break;
  }

  return selected;
};
