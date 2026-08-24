export type SchoolOrderWorkflowBlock = Readonly<{
  code:
    | 'ORDER_CUSTOMER_TYPE_IMMUTABLE'
    | 'SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED'
    | 'SCHOOL_PURCHASE_ORDER_REQUIRED'
    | 'SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED'
    | 'SCHOOL_ORDER_NOT_BINDING';
  message: string;
}>;

export const ORDER_CUSTOMER_TYPE_IMMUTABLE: SchoolOrderWorkflowBlock = {
  code: 'ORDER_CUSTOMER_TYPE_IMMUTABLE',
  message:
    'Po zaklju\u010dku osnutka tipa naro\u010dnika ni mogo\u010de spremeniti iz \u0161ole ali javnega zavoda v drug tip oziroma obratno.'
};

export const SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED: SchoolOrderWorkflowBlock = {
  code: 'SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED',
  message:
    'Zadnje aktivne naro\u010dilnice ni mogo\u010de odstraniti, dokler je naro\u010dilo \u0161ole ali javnega zavoda zavezujo\u010de oziroma v obdelavi.'
};

export const SCHOOL_PURCHASE_ORDER_REQUIRED: SchoolOrderWorkflowBlock = {
  code: 'SCHOOL_PURCHASE_ORDER_REQUIRED',
  message:
    'Pred potrditvijo naro\u010dila \u0161ole ali javnega zavoda mora biti nalo\u017eena naro\u010dilnica.'
};

export const SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED: SchoolOrderWorkflowBlock = {
  code: 'SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED',
  message:
    'Naro\u010dilnico je mogo\u010de nalo\u017eiti samo za prejeto naro\u010dilo \u0161ole ali javnega zavoda, ki \u010daka na potrditev.'
};

export const SCHOOL_ORDER_NOT_BINDING: SchoolOrderWorkflowBlock = {
  code: 'SCHOOL_ORDER_NOT_BINDING',
  message:
    'Naro\u010dilo \u0161ole ali javnega zavoda je mogo\u010de za\u010deti obdelovati \u0161ele po potrditvi naro\u010dilnice.'
};

export const SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS = [
  'customer-upload-pdf-v1',
  'customer-upload-jpeg-v1',
  'admin-upload-pdf-v1'
] as const;

export type SchoolPurchaseOrderProofFormatMarker =
  (typeof SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS)[number];

const SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKER_SET = new Set<string>(
  SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS
);

export function isSchoolPurchaseOrderProofFormatMarker(
  formatMarker: unknown
): formatMarker is SchoolPurchaseOrderProofFormatMarker {
  return (
    typeof formatMarker === 'string' &&
    SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKER_SET.has(formatMarker)
  );
}

const SCHOOL_EXECUTION_STATUSES = new Set([
  'in_progress',
  'partially_sent',
  'sent',
  'finished'
]);

export function orderCustomerTypeChangeBlock(
  currentCustomerType: string,
  nextCustomerType: string,
  isDraft: boolean
): SchoolOrderWorkflowBlock | null {
  return !isDraft &&
    currentCustomerType !== nextCustomerType &&
    (currentCustomerType === 'school' || nextCustomerType === 'school')
    ? ORDER_CUSTOMER_TYPE_IMMUTABLE
    : null;
}

export function schoolPurchaseOrderUploadBlock(
  customerType: string,
  commitmentStatus: string | null | undefined,
  orderStatus: string,
  isDeleted: boolean
): SchoolOrderWorkflowBlock | null {
  return isDeleted ||
    customerType !== 'school' ||
    commitmentStatus !== 'pending_confirmation' ||
    orderStatus !== 'received'
    ? SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED
    : null;
}

export function schoolBindingBlock(
  customerType: string,
  nextCommitmentStatus: string,
  hasActivePurchaseOrder: boolean
): SchoolOrderWorkflowBlock | null {
  return customerType === 'school' &&
    nextCommitmentStatus === 'binding' &&
    !hasActivePurchaseOrder
    ? SCHOOL_PURCHASE_ORDER_REQUIRED
    : null;
}

export function schoolExecutionBlock(
  customerType: string,
  commitmentStatus: string | null | undefined,
  nextOrderStatus: string,
  hasActivePurchaseOrder: boolean
): SchoolOrderWorkflowBlock | null {
  if (
    customerType !== 'school' ||
    !SCHOOL_EXECUTION_STATUSES.has(nextOrderStatus)
  ) {
    return null;
  }
  if (!hasActivePurchaseOrder) return SCHOOL_PURCHASE_ORDER_REQUIRED;
  return commitmentStatus !== 'binding' ? SCHOOL_ORDER_NOT_BINDING : null;
}

export function schoolPurchaseOrderDeletionBlock(
  customerType: string,
  commitmentStatus: string | null | undefined,
  orderStatus: string,
  documentType: string,
  documentFormatMarker: string | null | undefined,
  hasOtherActivePurchaseOrderProof: boolean
): SchoolOrderWorkflowBlock | null {
  if (
    documentType !== 'purchase_order' ||
    !isSchoolPurchaseOrderProofFormatMarker(documentFormatMarker) ||
    customerType !== 'school' ||
    hasOtherActivePurchaseOrderProof
  ) {
    return null;
  }

  return commitmentStatus === 'binding' ||
    SCHOOL_EXECUTION_STATUSES.has(orderStatus)
    ? SCHOOL_PURCHASE_ORDER_DELETE_BLOCKED
    : null;
}
