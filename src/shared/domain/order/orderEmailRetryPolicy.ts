import type { OrderEmailEventType } from './orderEmailSettings';

const RETRYABLE_FAILURE_CATEGORIES = new Set([
  'network',
  'request_timeout',
  'too_early',
  'rate_limited',
  'server_error'
]);

const STATUS_EVENT_TYPES = new Set<OrderEmailEventType>([
  'received',
  'in_progress',
  'partially_sent',
  'sent',
  'finished',
  'cancelled'
]);

export function orderEmailFailureCategory(lastError: unknown): string | null {
  if (typeof lastError !== 'string') return null;
  return /^\[([a-z_]+)\]/u.exec(lastError.trim())?.[1] ?? null;
}

export function isRetryableOrderEmailFailure(lastError: unknown): boolean {
  const category = orderEmailFailureCategory(lastError);
  return category !== null && RETRYABLE_FAILURE_CATEGORIES.has(category);
}

export function isOrderEmailRetryEventCurrent(input: {
  eventType: OrderEmailEventType;
  orderStatus: string;
  contractStatus: string | null;
}): boolean {
  if (STATUS_EVENT_TYPES.has(input.eventType)) {
    return input.orderStatus === input.eventType;
  }
  if (input.eventType === 'order_submitted') {
    return input.orderStatus === 'received' &&
      input.contractStatus === 'pending_seller_acceptance';
  }
  if (input.eventType === 'order_accepted') {
    return input.contractStatus === 'accepted';
  }
  if (
    input.eventType === 'predracun_issued' ||
    input.eventType === 'invoice_issued'
  ) {
    return input.contractStatus === 'accepted';
  }
  return input.eventType === 'order_rejected' &&
    input.contractStatus === 'rejected';
}
