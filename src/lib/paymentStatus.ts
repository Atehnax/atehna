export const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Neplačano', badgeClassName: 'border-slate-200 bg-slate-50 text-slate-700' },
  { value: 'paid', label: 'Plačano', badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: 'refunded', label: 'Povrnjeno', badgeClassName: 'border-indigo-200 bg-indigo-50 text-indigo-700' }
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_OPTIONS)[number]['value'];

type PaymentStatusMeta = {
  normalized: PaymentStatus;
  label: string;
  badgeClassName: string;
};

const PAYMENT_STATUS_META_BY_NORMALIZED = new Map<PaymentStatus, PaymentStatusMeta>(
  PAYMENT_STATUS_OPTIONS.map((option) => [
    option.value,
    { normalized: option.value, label: option.label, badgeClassName: option.badgeClassName }
  ])
);

const LEGACY_PAYMENT_STATUS_NORMALIZATION: Record<string, PaymentStatus> = {
  cancelled: 'unpaid',
  partially_paid: 'unpaid',
  partial_paid: 'unpaid',
  delno_placano: 'unpaid',
  partially_refunded: 'refunded',
  partial_refunded: 'refunded',
  delno_povrnjeno: 'refunded'
};

export const normalizePaymentStatus = (value: string | null | undefined): PaymentStatus => {
  if (!value) return 'unpaid';
  if (PAYMENT_STATUS_META_BY_NORMALIZED.has(value as PaymentStatus)) return value as PaymentStatus;
  return LEGACY_PAYMENT_STATUS_NORMALIZATION[value] ?? 'unpaid';
};

export const isPaymentStatus = (value: string): value is PaymentStatus =>
  PAYMENT_STATUS_META_BY_NORMALIZED.has(value as PaymentStatus);

export const getPaymentLabel = (status?: string | null) => {
  const normalized = normalizePaymentStatus(status);
  return PAYMENT_STATUS_META_BY_NORMALIZED.get(normalized)?.label ?? 'Neplačano';
};

export const getPaymentBadgeClassName = (status?: string | null) => {
  const normalized = normalizePaymentStatus(status);
  return (
    PAYMENT_STATUS_META_BY_NORMALIZED.get(normalized)?.badgeClassName ??
    'border-slate-200 bg-slate-50 text-slate-700'
  );
};
