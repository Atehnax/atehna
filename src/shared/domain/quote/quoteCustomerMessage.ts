const normalizeMessage = (value: unknown) =>
  typeof value === 'string' ? value.trim() : String(value ?? '').trim();

/**
 * Preserves both legacy customer-facing quote fields while presenting them as
 * one message. Identical legacy values are returned only once.
 */
export function getQuoteCustomerMessage(
  sellerMessage: unknown,
  customerVisibleNotes: unknown
): string {
  const messages = [
    normalizeMessage(sellerMessage),
    normalizeMessage(customerVisibleNotes)
  ].filter(Boolean);

  return [...new Set(messages)].join('\n\n');
}
