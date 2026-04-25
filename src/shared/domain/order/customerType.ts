export const CUSTOMER_TYPES = ['individual', 'company', 'school'] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_FORM_OPTIONS = [
  { value: 'individual', label: 'Fizična oseba' },
  { value: 'company', label: 'Podjetje' },
  { value: 'school', label: 'Šola / javni zavod' }
] as const satisfies ReadonlyArray<{ value: CustomerType; label: string }>;

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: 'Fiz. oseba',
  company: 'Podjetje',
  school: 'Šola'
};

export const isCustomerType = (value: string): value is CustomerType => value in CUSTOMER_TYPE_LABELS;

export const getCustomerTypeLabel = (value: string) =>
  isCustomerType(value) ? CUSTOMER_TYPE_LABELS[value] : value;
