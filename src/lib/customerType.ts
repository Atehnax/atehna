export type CustomerType = 'individual' | 'company' | 'school';

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: 'Fizična oseba',
  company: 'Podjetje',
  school: 'Šola / javni zavod'
};

export const getCustomerTypeLabel = (value: string) =>
  CUSTOMER_TYPE_LABELS[value as CustomerType] ?? value;
