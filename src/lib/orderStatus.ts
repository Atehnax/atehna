export const ORDER_STATUS_OPTIONS = [
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'sent', label: 'Poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' },
  { value: 'refunded_returned', label: 'Povrnjeno (artikli vrnjeni)' },
  { value: 'refunded_not_returned', label: 'Povrnjeno (artikli niso vrnjeni)' }
];

export const getStatusLabel = (value: string) =>
  ORDER_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
