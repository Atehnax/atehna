import {
  getStatusChipVariant,
  type ORDER_STATUS_OPTIONS
} from '@/shared/domain/order/orderStatus';
import type { OrderEmailEventType } from '@/shared/domain/order/orderEmailSettings';
import type { QuoteEmailEventType } from '@/shared/domain/quote/quoteEmailSettings';
import {
  getQuoteRequestStatusPresentation,
  type QuoteRequestStatusTone
} from '@/shared/domain/quote/quoteRequestStatus';

type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]['value'];
type OrderStatusTone = ReturnType<typeof getStatusChipVariant>;

export type AdminEmailEventStatusPresentation = Readonly<{
  tone: OrderStatusTone | QuoteRequestStatusTone;
  rowClassName: string;
  sectionClassName: string;
}>;

const ORDER_EVENT_STATUS: Partial<Record<OrderEmailEventType, OrderStatus>> = {
  order_submitted: 'received',
  received: 'received',
  in_progress: 'in_progress',
  partially_sent: 'partially_sent',
  sent: 'sent',
  finished: 'finished',
  cancelled: 'cancelled'
};
const ORDER_EVENT_TONE_OVERRIDE: Partial<
  Record<OrderEmailEventType, OrderStatusTone>
> = {
  order_accepted: 'success',
  order_rejected: 'danger'
};

const ORDER_ROW_CLASS_BY_TONE: Record<OrderStatusTone, string> = {
  neutral:
    'bg-[color:var(--ui-neutral-bg)] hover:!bg-[color:var(--ui-neutral-bg-hover)]',
  warning: 'bg-yellow-50 hover:!bg-yellow-100',
  info: 'bg-blue-50 hover:!bg-blue-100',
  success: 'bg-emerald-50 hover:!bg-emerald-100',
  danger: 'bg-orange-100 hover:!bg-orange-200'
};

const ORDER_SECTION_CLASS_BY_TONE: Record<OrderStatusTone, string> = {
  neutral: 'bg-slate-50/70',
  warning: 'bg-yellow-50/60',
  info: 'bg-blue-50/60',
  success: 'bg-emerald-50/60',
  danger: 'bg-orange-50/60'
};

type EditableQuoteEmailEvent = Exclude<
  QuoteEmailEventType,
  'quote_access_otp'
>;

const QUOTE_EVENT_STATUS: Partial<
  Record<EditableQuoteEmailEvent, string>
> = {
  quote_request_submitted: 'received',
  quote_clarification_requested: 'in_preparation',
  quote_issued: 'offer_issued',
  quote_accepted: 'accepted',
  quote_declined: 'declined',
  quote_withdrawn: 'withdrawn',
  quote_expired: 'expired',
  quote_request_closed: 'closed_without_offer'
};
const QUOTE_EVENT_TONE_OVERRIDE: Partial<
  Record<EditableQuoteEmailEvent, QuoteRequestStatusTone>
> = {
  quote_acceptance_blocked_stock: 'warning',
  quote_delivery_failed: 'danger'
};

const QUOTE_ROW_CLASS_BY_TONE: Record<
  QuoteRequestStatusTone,
  string
> = {
  neutral: 'bg-slate-100 hover:!bg-slate-200',
  warning: 'bg-amber-50 hover:!bg-amber-100',
  info: 'bg-blue-50 hover:!bg-blue-100',
  success: 'bg-emerald-50 hover:!bg-emerald-100',
  danger: 'bg-rose-50 hover:!bg-rose-100'
};

const QUOTE_SECTION_CLASS_BY_TONE: Record<
  QuoteRequestStatusTone,
  string
> = {
  neutral: 'bg-slate-50/70',
  warning: 'bg-amber-50/60',
  info: 'bg-blue-50/60',
  success: 'bg-emerald-50/60',
  danger: 'bg-rose-50/60'
};

export const getOrderEmailEventStatusPresentation = (
  eventType: OrderEmailEventType
): AdminEmailEventStatusPresentation => {
  const tone =
    ORDER_EVENT_TONE_OVERRIDE[eventType] ??
    getStatusChipVariant(ORDER_EVENT_STATUS[eventType] ?? 'received');
  return {
    tone,
    rowClassName: ORDER_ROW_CLASS_BY_TONE[tone],
    sectionClassName: ORDER_SECTION_CLASS_BY_TONE[tone]
  };
};

export const getQuoteEmailEventStatusPresentation = (
  eventType: EditableQuoteEmailEvent
): AdminEmailEventStatusPresentation => {
  const status = QUOTE_EVENT_STATUS[eventType];
  const tone =
    QUOTE_EVENT_TONE_OVERRIDE[eventType] ??
    (status ? getQuoteRequestStatusPresentation(status).tone : 'neutral');
  return {
    tone,
    rowClassName: QUOTE_ROW_CLASS_BY_TONE[tone],
    sectionClassName: QUOTE_SECTION_CLASS_BY_TONE[tone]
  };
};
