import type { OrderDocumentTemplate } from '@/shared/domain/order/orderDocumentTemplates';

export type OrderDocumentInspectorSnapshot = {
  template: OrderDocumentTemplate;
};

const cloneInspectorValue = <Value,>(value: Value): Value => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as Value;
};

/**
 * Inspector controls update the canvas live so users can preview changes.
 * This isolated snapshot makes Cancel a real rollback rather than a cosmetic close.
 */
export const createOrderDocumentInspectorSnapshot = (
  template: OrderDocumentTemplate
): OrderDocumentInspectorSnapshot => ({
  template: cloneInspectorValue(template)
});
