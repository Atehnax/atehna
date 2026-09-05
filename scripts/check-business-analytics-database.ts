import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { readE2eEnvironment } from './e2e-database.mjs';

// The repository guard requires an explicit loopback E2E database and namespace.
const { databaseUrl, databaseName } = readE2eEnvironment();
const pool = new Pool({ connectionString: databaseUrl, ssl: false });
const client = await pool.connect();
const rejectChange = async (sql: string, params: unknown[]) => {
  await client.query('savepoint expected_rejection');
  await assert.rejects(client.query(sql, params));
  await client.query('rollback to savepoint expected_rejection');
  await client.query('release savepoint expected_rejection');
};
try {
  const identity = await client.query('select current_database() as name');
  assert.equal(identity.rows[0]?.name, databaseName);
  await client.query('begin');
  const variant = (await client.query('select id, item_id from catalog_item_variants order by id limit 1')).rows[0];
  assert.ok(variant, 'Prepare the repository E2E catalogue fixture first.');
  await client.query('update catalog_item_variants set cost_net = 12.34 where id = $1', [variant.id]);
  const token = randomUUID();
  const created = await client.query(
    `insert into orders (order_number, customer_type, organization_name, contact_name, email,
      address_line1, city, postal_code, country_code, subtotal, tax, shipping, total, is_draft)
    values ($1, 'school', 'Šola – podružnica Črešnjevec', 'Test', 'analytics-fixture@example.test',
      'Črešnjevec 12A', 'Črešnjevec', '2310', 'SI', 100, 22, 3, 125, true) returning id`,
    ['analytics-fixture-' + token]
  );
  const orderId = created.rows[0].id;
  const line = await client.query(
    `insert into order_items (order_id, catalog_item_id, catalog_variant_id, sku, name, quantity,
      base_unit_net, unit_net, unit_tax, unit_gross, line_net, line_tax, line_gross, tax_rate)
    values ($1, $2, $3, 'ANALYTICS-FIXTURE', 'Merilna postavka', 1, 100, 100, 22, 122, 100, 22, 122, 0.22)
    returning id, historical_unit_cost_net`, [orderId, variant.item_id, variant.id]
  );
  assert.equal(line.rows[0].historical_unit_cost_net, null, 'Draft cost is not claimed as a submitted snapshot.');
  const draft = (await client.query('select analytics_snapshot_json, analytics_submitted_at from orders where id=$1', [orderId])).rows[0];
  assert.equal(draft.analytics_snapshot_json, null);
  assert.equal(draft.analytics_submitted_at, null);

  await client.query('update orders set is_draft = false where id = $1', [orderId]);
  const submitted = (await client.query('select * from orders where id = $1', [orderId])).rows[0];
  assert.equal(submitted.analytics_snapshot_json.origin, 'captured');
  assert.equal(submitted.analytics_snapshot_json.customerType, 'school');
  assert.equal(submitted.analytics_snapshot_json.address.addressLine1, 'Črešnjevec 12A');
  assert.equal(submitted.analytics_snapshot_json.subtotalNetCents, 10000);
  assert.equal(submitted.actual_packed_weight_grams, null);
  assert.equal(submitted.actual_parcel_count, null);
  assert.equal(submitted.actual_carrier_cost_net, null);
  assert.equal(submitted.preparation_minutes, null);
  assert.equal(submitted.shipping_tax_rate, null);
  assert.equal(submitted.parcel_count, 1);
  assert.equal(submitted.merchandise_refund_net, '0.00');
  assert.equal(submitted.refund_history_complete, true);
  assert.equal((await client.query('select historical_unit_cost_net from order_items where id=$1', [line.rows[0].id])).rows[0].historical_unit_cost_net, '12.34');
  await client.query('update catalog_item_variants set cost_net = 90 where id = $1', [variant.id]);
  await client.query("update orders set customer_type='company', address_line1='Drugo 1', subtotal=150 where id=$1", [orderId]);
  await client.query('update order_items set unit_net=150, line_net=150 where id=$1', [line.rows[0].id]);
  const preserved = (await client.query('select analytics_snapshot_json from orders where id=$1', [orderId])).rows[0].analytics_snapshot_json;
  assert.deepEqual(preserved, submitted.analytics_snapshot_json);
  await rejectChange("update orders set analytics_snapshot_json='{}'::jsonb where id=$1", [orderId]);
  await rejectChange("update orders set analytics_submitted_at=now()+interval '1 day' where id=$1", [orderId]);

  await client.query(
    `update orders set status='sent', contract_status='accepted',
      contract_accepted_at=now(), committed_at=now(), contract_accepted_actor_type='admin',
      contract_accepted_actor_id='analytics-fixture', contract_acceptance_evidence_json='{"fixture":true}'::jsonb
    where id=$1`, [orderId]
  );
  const fulfilled = (await client.query('select analytics_fulfilled_at, analytics_fulfilled_merchandise_net, analytics_fulfilled_lines_json from orders where id=$1', [orderId])).rows[0];
  assert.ok(fulfilled.analytics_fulfilled_at);
  assert.equal(fulfilled.analytics_fulfilled_merchandise_net, '150.00');
  assert.equal(fulfilled.analytics_fulfilled_lines_json[0].lineNetCents, 15000);
  assert.equal(fulfilled.analytics_fulfilled_lines_json[0].unitCostCents, 1234);
  await client.query("update orders set status='finished', subtotal=200 where id=$1", [orderId]);
  await client.query('update order_items set line_net=200 where id=$1', [line.rows[0].id]);
  const later = (await client.query('select analytics_fulfilled_at, analytics_fulfilled_merchandise_net, analytics_fulfilled_lines_json from orders where id=$1', [orderId])).rows[0];
  assert.deepEqual(later, fulfilled);
  await rejectChange('update orders set analytics_fulfilled_merchandise_net=0 where id=$1', [orderId]);
  await client.query("update orders set payment_status='refunded' where id=$1", [orderId]);
  assert.equal((await client.query('select refund_history_complete from orders where id=$1',[orderId])).rows[0].refund_history_complete, false);
  await client.query('update orders set merchandise_refund_net=25.50, refund_history_complete=true where id=$1', [orderId]);
  const net = (await client.query('select analytics_fulfilled_merchandise_net-merchandise_refund_net as net from orders where id=$1',[orderId])).rows[0].net;
  assert.equal(net, '124.50');
  await rejectChange('update orders set actual_packed_weight_grams=0 where id=$1', [orderId]);
  await rejectChange('update orders set merchandise_refund_net=null where id=$1', [orderId]);
  await client.query('rollback');
  console.info('Verified isolated PostgreSQL fixtures: draft submission; immutable original customer/address/value; historical cost capture; first fulfilment lines/value; refund completeness invalidation; missing operational data; database constraints. All fixtures rolled back.');
} finally {
  await client.query('rollback').catch(() => undefined);
  client.release(); await pool.end();
}
