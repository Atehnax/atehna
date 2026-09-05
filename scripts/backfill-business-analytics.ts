import nextEnv from '@next/env';
import { getPool } from '../src/shared/server/db';

// Explicit destination name is required; this operation never selects a database implicitly.
nextEnv.loadEnvConfig(process.cwd());
const nameArgument = process.argv.find((value) => value.startsWith('--database-name='));
const expectedName = nameArgument?.slice('--database-name='.length);
if (!process.argv.includes('--apply') || !expectedName) {
  throw new Error('Usage: npx tsx scripts/backfill-business-analytics.ts --database-name=VERIFIED_DATABASE --apply');
}
const pool = await getPool();
const identity = await pool.query('select current_database() as database_name');
if (identity.rows[0]?.database_name !== expectedName) {
  await pool.end();
  throw new Error('The connected database does not match the explicitly selected database name.');
}
let total = 0;
try {
  for (;;) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const batch = await client.query(
        `with selected_orders as (
          select orders.id from orders
          where not orders.is_draft and orders.analytics_snapshot_json is null
          order by orders.id limit 500 for update skip locked
        )
        update orders
        set analytics_submitted_at = orders.created_at,
          analytics_snapshot_json = jsonb_build_object(
            'version', 1, 'origin', 'legacy',
            'dateBasis', 'legacy-created-at',
            'customerType', orders.customer_type,
            'customerName', coalesce(nullif(orders.organization_name, ''), orders.contact_name),
            'address', jsonb_build_object(
              'addressLine1', orders.address_line1, 'addressLine2', orders.address_line2,
              'city', orders.city, 'postalCode', orders.postal_code,
              'countryCode', orders.country_code, 'gursHouseNumberId', orders.gurs_house_number_id
            ),
            'subtotalNetCents', (orders.subtotal * 100)::bigint,
            'shippingGrossCents', (orders.shipping * 100)::bigint,
            'taxCents', (orders.tax * 100)::bigint,
            'shippingSnapshot', orders.shipping_snapshot_json,
            'shippingTaxRate', orders.shipping_tax_rate,
            'capturedAt', now(),
            'source', case when orders.source_quote_offer_version_id is null then 'direct' else 'quote' end
          ),
          analytics_is_test = orders.analytics_is_test or exists (
            select 1 from quote_offer_versions
            join quote_requests on quote_requests.id = quote_offer_versions.quote_request_id
            where quote_offer_versions.id = orders.source_quote_offer_version_id
              and quote_requests.intake_source = 'admin_testing'
          )
        from selected_orders where orders.id = selected_orders.id
        returning orders.id`
      );
      await client.query(
        `update orders set
          analytics_fulfilled_at = fulfilled.first_fulfilled_at,
          analytics_fulfilled_merchandise_net = orders.subtotal,
          analytics_fulfilment_origin = 'legacy',
          analytics_fulfilled_lines_json = (
            select jsonb_agg(jsonb_build_object(
              'id', order_items.id::text,
              'key', case when order_items.catalog_variant_id is not null then 'variant:' || order_items.catalog_variant_id::text
                when order_items.catalog_item_id is not null then 'product:' || order_items.catalog_item_id::text
                else 'sku:' || order_items.sku end,
              'name', order_items.name, 'category', order_items.category_id,
              'quantity', order_items.quantity, 'lineNetCents', (order_items.line_net * 100)::bigint,
              'unitCostCents', (order_items.historical_unit_cost_net * 100)::bigint
            ) order by order_items.id)
            from order_items where order_items.order_id = orders.id
          )
        from (
          select order_status_logs.order_id, min(order_status_logs.created_at) as first_fulfilled_at
          from order_status_logs
          where order_status_logs.order_id = any($1::bigint[])
            and order_status_logs.new_status in ('sent', 'finished')
          group by order_status_logs.order_id
        ) as fulfilled
        where orders.id = fulfilled.order_id
          and orders.analytics_fulfilled_at is null
          and orders.contract_status = 'accepted' and orders.commitment_status = 'binding'`,
        [batch.rows.map((row) => row.id)]
      );
      await client.query('commit');
      total += batch.rowCount ?? 0;
      console.info(`Historical snapshots preserved: ${total}. Cost, refund and operational gaps remain unknown.`);
      if (!batch.rowCount) break;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
