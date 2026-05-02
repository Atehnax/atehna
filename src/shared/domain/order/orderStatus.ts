import {
  getStatusInfoMenuOptionClassName,
  type StatusInfoMenuOptionTone
} from './statusMenuOptionStyles';

export const ORDER_STATUS_OPTIONS = [
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'sent', label: 'Poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' }
] as const;

type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]['value'];

const STATUS_LABELS = new Map<OrderStatus, string>(
  ORDER_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

const STATUS_MENU_OPTION_TONES: Record<OrderStatus, StatusInfoMenuOptionTone> = {
  received: 'neutral',
  in_progress: 'warning',
  partially_sent: 'sky',
  sent: 'info',
  finished: 'success',
  cancelled: 'danger'
};

export const isOrderStatus = (value: string): value is OrderStatus =>
  STATUS_LABELS.has(value as OrderStatus);

export const getStatusLabel = (value: string) =>
  isOrderStatus(value) ? STATUS_LABELS.get(value) ?? 'Neznano' : 'Neznano';

export const getStatusMenuItemClassName = (value: string) =>
  getStatusInfoMenuOptionClassName(
    isOrderStatus(value) ? STATUS_MENU_OPTION_TONES[value] : 'neutral'
  );

export const getStatusChipVariant = (value: string) => {
  if (!isOrderStatus(value)) return 'neutral' as const;

  const variantMap: Record<OrderStatus, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
    received: 'neutral',
    in_progress: 'warning',
    partially_sent: 'info',
    sent: 'info',
    finished: 'success',
    cancelled: 'danger'
  };

  return variantMap[value];
};
