import type { CustomerType } from '@/shared/domain/order/customerType';

export const DEFAULT_QUOTE_DELIVERY_TERMS =
  'Dobava v roku dveh tednov.';
export const DEFAULT_QUOTE_PAYMENT_TERMS =
  'Plačilo v 30 dneh po izstavitvi računa.';

export const QUOTE_REQUEST_STATUSES = [
  'received',
  'in_preparation',
  'offer_issued',
  'awaiting_purchase_order_review',
  'accepted',
  'declined',
  'expired',
  'withdrawn',
  'converted_to_order',
  'closed_without_offer'
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

export const QUOTE_OFFER_STATUSES = [
  'draft',
  'issued',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'superseded'
] as const;

export type QuoteOfferStatus = (typeof QUOTE_OFFER_STATUSES)[number];

export const QUOTE_REASONS = [
  'formal_offer',
  'stock_or_delivery',
  'quantity_discount_or_custom_quantity',
  'other'
] as const;

export type QuoteReason = (typeof QUOTE_REASONS)[number];

export const QUOTE_REASON_OPTIONS = [
  { value: 'formal_offer', label: 'Formalno ponudbo za izbrane artikle' },
  { value: 'stock_or_delivery', label: 'Potrditev zaloge ali dobavnega roka' },
  {
    value: 'quantity_discount_or_custom_quantity',
    label: 'Količinski popust ali prilagojeno količino'
  },
  { value: 'other', label: 'Drugo' }
] as const satisfies ReadonlyArray<{ value: QuoteReason; label: string }>;

export const getQuoteReasonLabel = (value: string) =>
  QUOTE_REASON_OPTIONS.find((option) => option.value === value)?.label ?? value;

export type QuoteCustomerSnapshot = {
  customerType: CustomerType;
  organizationName: string | null;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  countryCode: 'SI';
  gursHouseNumberId: string | null;
  reference: string | null;
};

export function isQuoteReason(value: unknown): value is QuoteReason {
  return (
    typeof value === 'string' &&
    (QUOTE_REASONS as readonly string[]).includes(value)
  );
}

export function isQuoteOfferStatus(value: unknown): value is QuoteOfferStatus {
  return (
    typeof value === 'string' &&
    (QUOTE_OFFER_STATUSES as readonly string[]).includes(value)
  );
}
