export const ORDER_STATUS_OPTIONS = [
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'sent', label: 'Poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' }
] as const;

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]['value'];

const STATUS_LABELS = new Map<OrderStatus, string>(
  ORDER_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

const STATUS_CHIP_CLASSNAMES: Record<OrderStatus, string> = {
  received: 'border-slate-200 bg-[#f8f7fc] text-slate-700',
  in_progress: 'border-yellow-200 bg-[#f8f7fc] text-yellow-800',
  partially_sent: 'border-sky-200 bg-[#f8f7fc] text-sky-700',
  sent: 'border-blue-200 bg-[#f8f7fc] text-blue-700',
  finished: 'border-emerald-200 bg-[#f8f7fc] text-emerald-700',
  cancelled: 'border-orange-300 bg-[#f8f7fc] text-orange-900'
};

export const isOrderStatus = (value: string): value is OrderStatus =>
  STATUS_LABELS.has(value as OrderStatus);

export const getStatusLabel = (value: string) =>
  isOrderStatus(value) ? STATUS_LABELS.get(value) ?? 'Neznano' : 'Neznano';

export const getStatusChipClassName = (value: string) =>
  isOrderStatus(value)
    ? STATUS_CHIP_CLASSNAMES[value]
    : 'border-slate-200 bg-[#f8f7fc] text-slate-400';
