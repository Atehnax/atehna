export const ORDER_CONTRACT_STATUSES = [
  'pending_seller_acceptance',
  'accepted',
  'rejected'
] as const;

export type OrderContractStatus = (typeof ORDER_CONTRACT_STATUSES)[number];

export function isOrderContractStatus(value: unknown): value is OrderContractStatus {
  return (
    typeof value === 'string' &&
    (ORDER_CONTRACT_STATUSES as readonly string[]).includes(value)
  );
}

export function orderContractStatusLabel(status: OrderContractStatus): string {
  switch (status) {
    case 'pending_seller_acceptance':
      return 'Čaka na sprejem prodajalca';
    case 'accepted':
      return 'Sprejeto';
    case 'rejected':
      return 'Zavrnjeno';
  }
}
