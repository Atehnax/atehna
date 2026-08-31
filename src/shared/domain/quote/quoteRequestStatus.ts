import type { QuoteRequestStatus } from '@/shared/domain/quote/quoteTypes';
import { getStatusInfoMenuOptionClassName } from '@/shared/domain/order/statusMenuOptionStyles';

export const MANUALLY_EDITABLE_QUOTE_REQUEST_STATUSES = [
  'received',
  'in_preparation'
] as const satisfies ReadonlyArray<QuoteRequestStatus>;

export type ManuallyEditableQuoteRequestStatus =
  (typeof MANUALLY_EDITABLE_QUOTE_REQUEST_STATUSES)[number];

const MANUALLY_EDITABLE_STATUS_SET = new Set<string>(
  MANUALLY_EDITABLE_QUOTE_REQUEST_STATUSES
);

export type QuoteRequestStatusTone =
  | 'neutral'
  | 'warning'
  | 'info'
  | 'success'
  | 'danger';

export type QuoteRequestStatusPresentation = {
  label: string;
  description: string;
  tone: QuoteRequestStatusTone;
};

export type QuoteRequestVisibleStatusValue =
  | 'preparation'
  | 'received'
  | 'issued'
  | 'ordered'
  | 'declined'
  | 'expired';

export type QuoteRequestVisibleStatusOption = {
  value: QuoteRequestVisibleStatusValue;
  label: string;
  statuses: ReadonlyArray<QuoteRequestStatus>;
  presentationStatus: QuoteRequestStatus;
};

const PRESENTATION: Record<QuoteRequestStatus, QuoteRequestStatusPresentation> = {
  received: {
    label: 'Prejeto',
    description: 'Povpraševanje je prejeto in čaka na obdelavo.',
    tone: 'neutral'
  },
  in_preparation: {
    label: 'V pripravi',
    description: 'Ponudba se pripravlja in še ni bila izdana.',
    tone: 'warning'
  },
  offer_issued: {
    label: 'Izdano',
    description: 'Ponudba je izdana in čaka na odgovor stranke; stanje e-pošte je prikazano ločeno.',
    tone: 'info'
  },
  awaiting_purchase_order_review: {
    label: 'Izdano',
    description: 'Stranka je poslala naročilnico, ki čaka na administrativni pregled.',
    tone: 'info'
  },
  accepted: {
    label: 'Naročeno',
    description: 'Stranka je sprejela ponudbo.',
    tone: 'success'
  },
  declined: {
    label: 'Zavrnjeno',
    description: 'Stranka je ponudbo zavrnila.',
    tone: 'danger'
  },
  expired: {
    label: 'Poteklo',
    description: 'Veljavnost izdane ponudbe je potekla.',
    tone: 'warning'
  },
  withdrawn: {
    label: 'Zavrnjeno',
    description: 'Izdana ponudba je umaknjena in povezava stranke ni več veljavna.',
    tone: 'danger'
  },
  converted_to_order: {
    label: 'Naročeno',
    description: 'Ponudba je sprejeta in iz nje je ustvarjeno naročilo.',
    tone: 'success'
  },
  closed_without_offer: {
    label: 'Zavrnjeno',
    description: 'Povpraševanje je zaključeno, ne da bi bila ponudba izdana.',
    tone: 'danger'
  }
};

const UNKNOWN_PRESENTATION: QuoteRequestStatusPresentation = {
  label: 'Neznano',
  description: 'Status poteka ni prepoznan.',
  tone: 'neutral'
};

export const QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS = [
  {
    value: 'preparation',
    label: 'V pripravi',
    statuses: ['in_preparation'],
    presentationStatus: 'in_preparation'
  },
  {
    value: 'received',
    label: 'Prejeto',
    statuses: ['received'],
    presentationStatus: 'received'
  },
  {
    value: 'issued',
    label: 'Izdano',
    statuses: ['offer_issued', 'awaiting_purchase_order_review'],
    presentationStatus: 'offer_issued'
  },
  {
    value: 'ordered',
    label: 'Naročeno',
    statuses: ['accepted', 'converted_to_order'],
    presentationStatus: 'accepted'
  },
  {
    value: 'declined',
    label: 'Zavrnjeno',
    statuses: ['declined', 'withdrawn', 'closed_without_offer'],
    presentationStatus: 'declined'
  },
  {
    value: 'expired',
    label: 'Poteklo',
    statuses: ['expired'],
    presentationStatus: 'expired'
  }
] as const satisfies ReadonlyArray<QuoteRequestVisibleStatusOption>;

export const getQuoteRequestVisibleStatusValue = (
  status: string
): QuoteRequestVisibleStatusValue | null =>
  QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS.find((option) =>
    option.statuses.some((requestStatus) => requestStatus === status)
  )?.value ?? null;

export const isQuoteRequestStatus = (value: string): value is QuoteRequestStatus =>
  Object.prototype.hasOwnProperty.call(PRESENTATION, value);

export const getQuoteRequestStatusPresentation = (
  value: string
): QuoteRequestStatusPresentation =>
  isQuoteRequestStatus(value) ? PRESENTATION[value] : UNKNOWN_PRESENTATION;

export const getQuoteRequestStatusLabel = (value: string) =>
  getQuoteRequestStatusPresentation(value).label;

export const isManuallyEditableQuoteRequestStatus = (
  value: string
): value is ManuallyEditableQuoteRequestStatus =>
  MANUALLY_EDITABLE_STATUS_SET.has(value);

export const QUOTE_REQUEST_MANUAL_STATUS_OPTIONS =
  MANUALLY_EDITABLE_QUOTE_REQUEST_STATUSES.map((value) => ({
    value,
    label: PRESENTATION[value].label
  }));

export const getQuoteRequestStatusMenuItemClassName = (value: string) =>
  getStatusInfoMenuOptionClassName(
    getQuoteRequestStatusPresentation(value).tone
  );
