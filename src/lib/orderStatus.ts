export const ORDER_STATUS_OPTIONS = [
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'sent', label: 'Poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' }
] as const;

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]['value'];

const LEGACY_ORDER_STATUS_MAP: Record<string, OrderStatus | 'legacy_refunded'> = {
  refunded_returned: 'legacy_refunded'
};

const ORDER_STATUS_LABELS = new Map<OrderStatus, string>(
  ORDER_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

const ORDER_STATUS_CHIP_CLASSNAMES: Record<OrderStatus | 'legacy_refunded' | 'unknown', string> = {
  received: 'border-slate-200 bg-slate-50 text-slate-700',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-700',
  partially_sent: 'border-sky-200 bg-sky-50 text-sky-700',
  sent: 'border-blue-200 bg-blue-50 text-blue-700',
  finished: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-orange-200 bg-orange-50 text-orange-700',
  legacy_refunded: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  unknown: 'border-slate-200 bg-slate-50 text-slate-700'
};

export const normalizeOrderStatus = (status: string): OrderStatus | 'legacy_refunded' | 'unknown' => {
  if (status in LEGACY_ORDER_STATUS_MAP) return LEGACY_ORDER_STATUS_MAP[status];
  const matched = ORDER_STATUS_OPTIONS.find((option) => option.value === status)?.value;
  return matched ?? 'unknown';
};

export const getStatusLabel = (value: string) => {
  const normalizedStatus = normalizeOrderStatus(value);
  if (normalizedStatus === 'legacy_refunded') return 'Povrnjeno';
  if (normalizedStatus === 'unknown') return value;
  return ORDER_STATUS_LABELS.get(normalizedStatus) ?? value;
};

export const getStatusChipClassName = (value: string) => {
  const normalizedStatus = normalizeOrderStatus(value);
  return ORDER_STATUS_CHIP_CLASSNAMES[normalizedStatus];
};
