export const ORDER_CONTRACT_STATUSES = [
  'pending_seller_acceptance',
  'accepted',
  'rejected'
] as const;

export type OrderContractStatus = (typeof ORDER_CONTRACT_STATUSES)[number];

export const ORDER_STATUS_SELLER_ACCEPTANCE_REQUIRED = {
  code: 'ORDER_STATUS_SELLER_ACCEPTANCE_REQUIRED',
  message:
    'Naročilo sprejmete s spremembo statusa iz »Prejeto« v »V obdelavi«.'
} as const;

export type DirectOrderSellerAcceptanceTransition = Readonly<{
  previousStatus: string | null;
  nextStatus: string;
  customerType: string;
  commitmentStatus: string | null;
  contractStatus: string | null;
  sourceQuoteOfferVersionId: unknown;
}>;

export function isDirectOrderSellerAcceptanceTransition(
  transition: DirectOrderSellerAcceptanceTransition
): boolean {
  return (
    transition.previousStatus === 'received' &&
    transition.nextStatus === 'in_progress' &&
    (transition.customerType === 'individual' ||
      transition.customerType === 'company') &&
    (transition.commitmentStatus === 'binding' ||
      transition.commitmentStatus === 'pending_confirmation') &&
    transition.contractStatus === 'pending_seller_acceptance' &&
    (transition.sourceQuoteOfferVersionId === null ||
      transition.sourceQuoteOfferVersionId === undefined)
  );
}

export type SchoolOrderSellerAcceptanceTransition =
  DirectOrderSellerAcceptanceTransition &
    Readonly<{ hasPurchaseOrderEvidence: boolean }>;

export function isSchoolOrderSellerAcceptanceTransition(
  transition: SchoolOrderSellerAcceptanceTransition
): boolean {
  return (
    transition.previousStatus === 'received' &&
    transition.nextStatus === 'in_progress' &&
    transition.customerType === 'school' &&
    (transition.commitmentStatus === 'pending_confirmation' ||
      transition.commitmentStatus === 'binding') &&
    transition.contractStatus === 'pending_seller_acceptance' &&
    transition.hasPurchaseOrderEvidence
  );
}

export type DirectSchoolOrderSellerAcceptanceTransition =
  SchoolOrderSellerAcceptanceTransition;

export const isDirectSchoolOrderSellerAcceptanceTransition =
  isSchoolOrderSellerAcceptanceTransition;

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
