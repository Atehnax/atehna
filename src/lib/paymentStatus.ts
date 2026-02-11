export const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Neplačano', badgeClassName: 'bg-slate-100 text-slate-600' },
  { value: 'paid', label: 'Plačano', badgeClassName: 'bg-emerald-100 text-emerald-700' },
  { value: 'refunded', label: 'Povrnjeno', badgeClassName: 'bg-amber-100 text-amber-700' },
  { value: 'cancelled', label: 'Preklicano', badgeClassName: 'bg-rose-100 text-rose-700' }
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_OPTIONS)[number]['value'];

type PaymentStatusMeta = {
  label: string;
  badgeClassName: string;
};

const PAYMENT_STATUS_META = new Map<PaymentStatus, PaymentStatusMeta>(
  PAYMENT_STATUS_OPTIONS.map((option) => [
    option.value,
    { label: option.label, badgeClassName: option.badgeClassName }
  ])
);

export const isPaymentStatus = (value: string): value is PaymentStatus =>
  PAYMENT_STATUS_META.has(value as PaymentStatus);

export const getPaymentLabel = (status?: string | null) =>
  (status && isPaymentStatus(status) ? PAYMENT_STATUS_META.get(status)?.label : null) ??
  'Neplačano';

export const getPaymentBadgeClassName = (status?: string | null) =>
  (status && isPaymentStatus(status) ? PAYMENT_STATUS_META.get(status)?.badgeClassName : null) ??
  'bg-slate-100 text-slate-600';
