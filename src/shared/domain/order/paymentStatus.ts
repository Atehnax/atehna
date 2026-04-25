import {
  getAdminStatusInfoMenuOptionClassName,
  type AdminStatusInfoMenuOptionTone
} from '@/shared/ui/theme/tokens';

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Neplačano', badgeClassName: 'border-slate-300 bg-[color:var(--ui-neutral-bg)] text-slate-700' },
  { value: 'paid', label: 'Plačano', badgeClassName: 'border-emerald-700/35 bg-emerald-50 text-emerald-700' },
  { value: 'refunded', label: 'Povrnjeno', badgeClassName: 'border-violet-200 bg-violet-50 text-violet-700' }
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_OPTIONS)[number]['value'];

const PAYMENT_STATUS_META = new Map<PaymentStatus, { label: string; badgeClassName: string }>(
  PAYMENT_STATUS_OPTIONS.map((option) => [
    option.value,
    { label: option.label, badgeClassName: option.badgeClassName }
  ])
);

const PAYMENT_MENU_OPTION_TONES: Record<PaymentStatus, AdminStatusInfoMenuOptionTone> = {
  unpaid: 'neutral',
  paid: 'success',
  refunded: 'purple'
};

export const isPaymentStatus = (value: string): value is PaymentStatus =>
  PAYMENT_STATUS_META.has(value as PaymentStatus);

export const getPaymentLabel = (status?: string | null) => {
  if (!status || !isPaymentStatus(status)) return 'Neznano';
  return PAYMENT_STATUS_META.get(status)?.label ?? 'Neznano';
};

export const getPaymentBadgeClassName = (status?: string | null) => {
  if (!status || !isPaymentStatus(status)) return 'border-slate-300 bg-[color:var(--ui-neutral-bg)] text-slate-400';
  return (
    PAYMENT_STATUS_META.get(status)?.badgeClassName ??
    'border-slate-300 bg-[color:var(--ui-neutral-bg)] text-slate-400'
  );
};

export const getPaymentMenuItemClassName = (status?: string | null) =>
  getAdminStatusInfoMenuOptionClassName(
    status && isPaymentStatus(status) ? PAYMENT_MENU_OPTION_TONES[status] : 'neutral'
  );


export const getPaymentBadgeVariant = (status?: string | null) => {
  if (!status || !isPaymentStatus(status)) return 'neutral' as const;

  const variantMap: Record<PaymentStatus, 'neutral' | 'success' | 'purple'> = {
    unpaid: 'neutral',
    paid: 'success',
    refunded: 'purple'
  };

  return variantMap[status];
};
