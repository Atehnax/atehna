import { getStatusLabel } from './orderStatus';
import { ORDER_PDF_TYPE_CONFIGS, type OrderPdfTypeKey } from './orderTypes';

type DocumentRequirementOrder = {
  customer_type?: unknown;
  entry_source?: unknown;
  is_historical?: unknown;
};

export function requiredOrderStatusDocuments(
  order: DocumentRequirementOrder,
  status: string
): readonly OrderPdfTypeKey[] {
  if (!['partially_sent', 'sent', 'finished'].includes(status)) return [];
  if (order.is_historical === true) return ['invoice'];

  // The mandatory final invoice also satisfies the proforma requirement.
  const required: OrderPdfTypeKey[] = ['dobavnica', status === 'finished' ? 'invoice' : 'predracun'];
  if (order.customer_type === 'school') required.push('purchase_order');
  if (status === 'finished') {
    if (order.entry_source !== 'manual') required.push('order_summary');
  }
  return required;
}

export function orderStatusDocumentBlock(
  order: DocumentRequirementOrder,
  status: string,
  availableDocumentTypes: Iterable<string>
) {
  const available = new Set(availableDocumentTypes);
  const missingDocumentTypes = requiredOrderStatusDocuments(order, status).filter(
    (type) => !available.has(type)
  );
  if (missingDocumentTypes.length === 0) return null;

  const labels = missingDocumentTypes.map((type) =>
    ORDER_PDF_TYPE_CONFIGS.find((document) => document.key === type)!.label
  );
  return {
    code: 'ORDER_STATUS_DOCUMENTS_REQUIRED' as const,
    message: `Statusa ni mogoče spremeniti v »${getStatusLabel(status)}«. Najprej ustvarite oziroma naložite manjkajoče PDF dokumente: ${labels.join(', ')}.`,
    missingDocumentTypes
  };
}
