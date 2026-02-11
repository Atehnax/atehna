export const ORDER_STATUS_OPTIONS = [
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'sent', label: 'Poslano' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' },
  { value: 'refunded_returned', label: 'Povrnjeno' },
] as const;

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]['value'];

const ORDER_STATUS_LABELS = new Map<OrderStatus, string>(
  ORDER_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

export const getStatusLabel = (value: string) =>
  ORDER_STATUS_LABELS.get(value as OrderStatus) ?? value;
