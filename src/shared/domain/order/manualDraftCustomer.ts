type DraftRow = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const emptyIdentity = (row: DraftRow) => ['address_line1', 'address_line2', 'postal_code', 'city', 'gurs_house_number_id', 'reference'].every(key => !text(row[key]));

/** Only recognize the exact generated customer signature on an unfinished manual record. */
export function isLegacyManualDraftCustomer(row: DraftRow, kind: 'order' | 'quote'): boolean {
  if (row.customer_type !== 'company' || row.contact_name !== 'Osnutek' || !emptyIdentity(row)) return false;
  if (kind === 'order') {
    return row.is_draft === true && row.entry_source === 'manual' && !text(row.organization_name)
      && !row.source_quote_offer_version_id
      && (row.email === 'draft@atehna.si' || (row.is_historical === true && row.email === ''));
  }
  return ['admin_email', 'admin_testing'].includes(String(row.intake_source))
    && ['received', 'in_preparation'].includes(String(row.status))
    && row.organization_name === 'Osnutek' && row.email === 'draft@atehna.si'
    && (!row.latest_offer_status || row.latest_offer_status === 'draft');
}

/** Read-model compatibility only: stored customer data is never rewritten. */
export function normalizeManualDraftCustomer<T extends DraftRow>(row: T, kind: 'order' | 'quote'): T {
  return isLegacyManualDraftCustomer(row, kind)
    ? { ...row, contact_name: '', organization_name: null }
    : row;
}
