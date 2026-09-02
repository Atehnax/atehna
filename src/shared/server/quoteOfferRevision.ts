import type { PoolClient } from 'pg';

export type QuoteOfferRevisionSource = Record<string, unknown> & {
  id: string | number;
  status: string;
};

export type CreatedQuoteOfferDraftRevision = {
  id: number;
  versionNumber: number;
  stateVersion: number;
  createdAt: unknown;
  validUntil: unknown;
};

/**
 * Copies an immutable historical offer into a new editable draft.
 * The SQL copy performs no catalog lookup, repricing, stock, or document work.
 */
export async function createQuoteOfferDraftRevision(
  client: PoolClient,
  input: {
    quoteRequestId: number;
    source: QuoteOfferRevisionSource;
    actorId: string | null;
  }
): Promise<CreatedQuoteOfferDraftRevision> {
  const versionResult = await client.query(
    `select coalesce(max(version_number), 0)::int + 1 as next_version
     from quote_offer_versions
     where quote_request_id = $1`,
    [input.quoteRequestId]
  );
  const nextVersion = Number(versionResult.rows[0]?.next_version);
  const createdResult = await client.query(
    `
      insert into quote_offer_versions (
        quote_request_id, version_number, status, is_current,
        customer_snapshot_json, billing_snapshot_json, seller_message,
        customer_visible_notes, admin_notes, delivery_terms, payment_terms,
        acceptance_method, subtotal, tax, shipping, total, currency, tax_rate,
        shipping_snapshot_json, terms_text, terms_version, valid_until,
        created_by_actor_type, created_by_actor_id
      )
      values (
        $1, $2, 'draft', false, $3::jsonb, $4::jsonb, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
        $18, $19, now() + interval '1 month', 'admin', $20
      )
      returning id, state_version, created_at, valid_until
    `,
    [
      input.quoteRequestId,
      nextVersion,
      JSON.stringify(input.source.customer_snapshot_json),
      JSON.stringify(input.source.billing_snapshot_json),
      input.source.seller_message,
      input.source.customer_visible_notes,
      input.source.admin_notes,
      input.source.delivery_terms,
      input.source.payment_terms,
      input.source.acceptance_method,
      input.source.subtotal,
      input.source.tax,
      input.source.shipping,
      input.source.total,
      input.source.currency,
      input.source.tax_rate,
      JSON.stringify(input.source.shipping_snapshot_json),
      input.source.terms_text,
      input.source.terms_version,
      input.actorId
    ]
  );
  const created = createdResult.rows[0];
  const newOfferVersionId = Number(created.id);

  await client.query(
    `
      insert into quote_offer_version_items (
        quote_offer_version_id, line_number, catalog_item_id,
        catalog_variant_id, product_slug, product_name, variant_name, sku,
        unit, quantity, min_order, available_stock_at_request, category_id,
        category_path, selected_attributes, image_url, base_unit_net,
        discount_pct, unit_net, unit_tax, unit_gross, line_net, line_tax,
        line_gross, tax_rate, currency, snapshot_json
      )
      select
        $2, line_number, catalog_item_id, catalog_variant_id, product_slug,
        product_name, variant_name, sku, unit, quantity, min_order,
        available_stock_at_request, category_id, category_path,
        selected_attributes, image_url, base_unit_net, discount_pct, unit_net,
        unit_tax, unit_gross, line_net, line_tax, line_gross, tax_rate,
        currency, snapshot_json
      from quote_offer_version_items
      where quote_offer_version_id = $1
      order by line_number
    `,
    [input.source.id, newOfferVersionId]
  );

  return {
    id: newOfferVersionId,
    versionNumber: nextVersion,
    stateVersion: Number(created.state_version),
    createdAt: created.created_at,
    validUntil: created.valid_until
  };
}
