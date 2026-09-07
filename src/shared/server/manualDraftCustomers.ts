/** Matches the legacy or current generated customer signature, never a partly populated draft. */
export const GENERATED_ORDER_DRAFT_CUSTOMER_SQL = `coalesce((
  orders.is_draft = true and orders.entry_source = 'manual' and orders.customer_type = 'company'
  and orders.contact_name in ('', 'Osnutek')
  and (orders.email = 'draft@atehna.si' or (orders.is_historical = true and orders.email = ''))
  and orders.source_quote_offer_version_id is null
  and nullif(btrim(coalesce(orders.organization_name, '')), '') is null
  and nullif(btrim(coalesce(orders.address_line1, '')), '') is null
  and nullif(btrim(coalesce(orders.address_line2, '')), '') is null
  and nullif(btrim(coalesce(orders.postal_code, '')), '') is null
  and nullif(btrim(coalesce(orders.city, '')), '') is null
  and nullif(btrim(coalesce(orders.gurs_house_number_id, '')), '') is null
  and nullif(btrim(coalesce(orders.reference, '')), '') is null
), false)`;
