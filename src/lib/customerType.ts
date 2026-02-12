export type CustomerType = 'individual' | 'company' | 'school';

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: 'Fiz. oseba',
  company: 'Podjetje',
  school: 'Šola'
};

const isCustomerType = (value: string): value is CustomerType => value in CUSTOMER_TYPE_LABELS;

export const getCustomerTypeLabel = (value: string) =>
  isCustomerType(value) ? CUSTOMER_TYPE_LABELS[value] : value;
