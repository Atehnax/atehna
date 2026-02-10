export const ORDER_STATUS_OPTIONS = [
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'sent', label: 'Poslano' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' },
  { value: 'refunded_returned', label: 'Povrnjeno' },
];

export const getStatusLabel = (value: string) =>
  ORDER_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
