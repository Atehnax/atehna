import * as manualDraftSql from '../src/shared/server/manualDraftCustomers';
import * as manualDraftCustomer from '../src/shared/domain/order/manualDraftCustomer';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { Pool } from 'pg';
import ts from 'typescript';
import { readE2eEnvironment } from './e2e-database.mjs';
import * as historicalDomain from '../src/shared/domain/order/historicalOrder';
import * as shippingDomain from '../src/shared/domain/shipping/shipping';
import * as auditDiff from '../src/shared/audit/auditDiff';
import * as orderTypes from '../src/shared/domain/order/orderTypes';
import * as pagination from '../src/shared/domain/pagination';
import * as orderStatus from '../src/shared/domain/order/orderStatus';
import * as commercePublicCode from '../src/shared/domain/commercePublicCode';
import * as gursAddress from '../src/shared/domain/address/gursAddress';

// Never load .env files. The reviewed parent launcher supplies only loopback credentials.
const environment = readE2eEnvironment();
assert.equal(environment.databaseName, 'atehna_e2e_history_20260907_contract');
assert.equal(new URL(environment.databaseUrl).port, '55434');
const pool = new Pool({ connectionString: environment.databaseUrl, ssl: false, max: 1 });
const client = await pool.connect();
const queries: string[] = [];
let failMandatoryHistory = false;
const operationClient = {
  async query(sql: string, parameters?: unknown[]) {
    queries.push(sql);
    if (failMandatoryHistory && sql.startsWith('insert into order_historical_changes')) throw new Error('Fixture mandatory history failure');
    if (sql.toLowerCase() === 'begin') return client.query('savepoint historical_operation');
    if (sql.toLowerCase() === 'commit') return client.query('release savepoint historical_operation');
    if (sql.toLowerCase() === 'rollback') return client.query('rollback to savepoint historical_operation');
    return client.query(sql, parameters);
  },
  release() {}
};
const getPool = async () => ({ connect: async () => operationClient, query: operationClient.query });
const audit = { getAuditActor: async () => ({ actor_id: 'admin:historical-db-fixture' }), insertAuditEventForRequest: async () => null };
const modules: Record<string, unknown> = {
    '@/shared/domain/order/manualDraftCustomer': manualDraftCustomer,
    '@/shared/server/manualDraftCustomers': manualDraftSql,
  'server-only': {},
  'next/server': { NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) } },
  './db': { getPool }, '@/shared/server/db': { getPool },
  './audit': audit, '@/shared/server/audit': audit,
  './revalidateAdminOrders': { revalidateAdminOrderPaths() {} },
  '@/shared/domain/order/historicalOrder': historicalDomain,
  '@/shared/domain/shipping/shipping': shippingDomain,
  '@/shared/audit/auditDiff': auditDiff,
  '@/shared/server/requestJson': {
    isJsonRecord: (value: unknown) => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    readRequiredJsonRecord: async (request: Request) => ({ ok: true, body: await request.json() })
  },
  '@/shared/server/shipping': { getShippingConfiguration: async () => { throw new Error('Historical item edits must not read current shipping rules.'); } },
  '@/shared/domain/order/orderTypes': orderTypes,
  '@/shared/domain/pagination': pagination,
  '@/shared/domain/order/orderStatus': orderStatus,
  '@/shared/domain/commercePublicCode': commercePublicCode,
  '@/shared/domain/address/gursAddress': gursAddress,
  '@/shared/server/diagnostics/instrumentation': {}
};
function load<T>(filename: string): T {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(filename), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, require: (name: string) => { assert(name in modules, 'Unexpected workflow dependency: ' + name); return modules[name]; } });
  return exports as T;
}
modules['./orders'] = load('src/shared/server/orders.ts');
modules['./gursAddresses'] = load('src/shared/server/gursAddresses.ts');
const historical = load<{
  handleHistoricalOrderDetails(request: Request, id: number, body: Record<string, unknown>): Promise<Response | null>;
  rejectHistoricalOrderOperation(id: number): Promise<Response | null>;
}>('src/shared/server/historicalOrders.ts');
const items = load<{ POST(request: Request, props: { params: Promise<{ orderId: string }> }): Promise<Response> }>('src/admin/api/orders/[orderId]/items/route.ts');
const request = (body: Record<string, unknown>) => new Request('http://localhost/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function rejection(sql: string, values: unknown[], pattern?: RegExp) {
  await client.query('savepoint expected_rejection');
  const operation = client.query(sql, values);
  if (pattern) await assert.rejects(operation, pattern);
  else await assert.rejects(operation);
  await client.query('rollback to savepoint expected_rejection');
  await client.query('release savepoint expected_rejection');
}
try {
  const identity = (await client.query('select current_database() as name, host(inet_server_addr()) as address')).rows[0];
  assert.equal(identity.name, environment.databaseName);
  assert.ok(['127.0.0.1', '::1'].includes(identity.address));
  await client.query('begin');
  await client.query("set local statement_timeout='30s'");
  const generated = { is_draft:true, entry_source:'manual', customer_type:'company', contact_name:'Osnutek', email:'draft@atehna.si' };
  for (const patch of [{}, {contact_name:''}, {email:'',is_historical:true}, {entry_source:null}, {is_draft:false}, {email:'real@example.test'}, {organization_name:'Actual company'}, {address_line1:'Actual street'}, {reference:'Actual reference'}]) {
    const row={...generated,...patch};
    const expected=row.contact_name === ''
      ? manualDraftCustomer.isLegacyManualDraftCustomer({...row,contact_name:'Osnutek'},'order')
      : manualDraftCustomer.isLegacyManualDraftCustomer(row,'order');
    const result=await client.query(`select ${manualDraftSql.GENERATED_ORDER_DRAFT_CUSTOMER_SQL} as generated
      from jsonb_to_record($1::jsonb) as orders(is_draft boolean,entry_source text,customer_type text,contact_name text,email text,is_historical boolean,source_quote_offer_version_id bigint,organization_name text,address_line1 text,address_line2 text,postal_code text,city text,gurs_house_number_id text,reference text)`,[JSON.stringify(row)]);
    assert.equal(result.rows[0].generated,expected,'Generated-customer SQL must match read normalization and remain null-safe.');
  }
  const token = randomUUID();
  const itemId = Number((await client.query("insert into catalog_items(item_name,item_type,status,slug) values($1,'unit','inactive',$2) returning id", ['Historical fixture', 'historical-' + token])).rows[0].id);
  const variantId = Number((await client.query("insert into catalog_item_variants(item_id,variant_name,variant_sku,price,cost_net,inventory,status) values($1,'Old',$2,999,12.34,10,'inactive') returning id", [itemId, 'HIST-' + token])).rows[0].id);
  const insertOrder = "insert into orders(order_number,customer_type,contact_name,email,address_line1,city,postal_code,country_code,subtotal,tax,shipping,total,is_draft,is_historical,entry_source,original_reference_system,original_reference,created_at,stock_enforcement_applied,merchandise_refund_net,refund_history_complete) values($1,'individual','Historical fixture','','','','','SI',0,0,0,0,true,true,'manual',$2,$3,'2018-03-10T00:00:00Z',false,null,false) returning *";
  let order = (await client.query(insertOrder, ['historical-' + token, 'Fixture ERP', token])).rows[0];
  const id = Number(order.id);
  const recorded = order.recorded_at.toISOString();
  assert.ok(new Date(recorded).getTime() > Date.now() - 60000);
  assert.equal(order.analytics_submitted_at, null);
  const readOrder = async () => (await client.query('select * from orders where id=$1', [id])).rows[0];
  const readHistory = async () => (await client.query('select * from order_historical_changes where order_id=$1 order by revision', [id])).rows;
  const baseRows = [
    { catalogItemId: itemId, catalogVariantId: variantId, sku: 'ORIGINAL-CODE', name: 'Original linked name', unit: 'kos', quantity: 1, unitPrice: 100, discountPercentage: 0 },
    { sku: 'DISCONTINUED-2018', name: 'Original manual name', unit: 'kom', quantity: 2, unitPrice: 25, discountPercentage: 0 }
  ];
  const sendItems = (body: Record<string, unknown>) => items.POST(request(body), { params: Promise.resolve({ orderId: String(id) }) });
  const itemBody = { expectedHistoricalRevision: String(order.historical_revision), expectedPricingRevision: order.pricing_revision, historicalTaxRate: '0.20', items: baseRows };
  const saved = await sendItems(itemBody);
  assert.equal(saved.status, 200, JSON.stringify(await saved.clone().json()));
  const itemResult = await saved.json();
  assert.equal(itemResult.totals.subtotal, 150);assert.equal(itemResult.totals.tax, 30);assert.equal(itemResult.totals.shipping, 0);
  assert.equal(itemResult.items[1].catalogVariantId, null);assert.equal(itemResult.items[1].name, 'Original manual name');
  order = await readOrder();
  assert.equal(order.is_draft, true);assert.equal(order.tax_rate, '0.2000');
  assert.equal(order.analytics_submitted_at, null);assert.equal(order.historical_revision, itemResult.historicalRevision);
  assert.equal((await readHistory()).length, 1);
  assert.equal((await sendItems(itemBody)).status, 409, 'Stale original metadata/item revisions must conflict.');
  assert.equal((await sendItems({ ...itemBody, expectedHistoricalRevision: order.historical_revision })).status, 409, 'Stale pricing revision must conflict independently.');
  assert.equal((await client.query('select inventory from catalog_item_variants where id=$1', [variantId])).rows[0].inventory, 10);
  assert.ok((await client.query('select historical_unit_cost_net from order_items where order_id=$1', [id])).rows.every(row => row.historical_unit_cost_net === null));
  await rejection('update orders set is_draft=false where id=$1', [id], /completed explicitly/);
  const finalize = { expectedHistoricalRevision: order.historical_revision, expectedPricingRevision: order.pricing_revision, historicalComplete: true, historicalStatus: 'finished', historicalPaymentStatus: 'paid', historicalShippingGross: '3.00', historicalNotes: 'Original paper record', customerType: 'company', organizationName: 'Original company', contactName: 'Customer saved with completion', notes: 'Original customer message' };
  const completed = await historical.handleHistoricalOrderDetails(request(finalize), id, finalize);
  assert.equal(completed?.status, 200, JSON.stringify(await completed!.clone().json()));
  order = await readOrder();
  assert.equal(order.is_draft, false);assert.equal(order.created_at.toISOString(), '2018-03-10T00:00:00.000Z');
  assert.equal(order.recorded_at.toISOString(), recorded);assert.equal(order.total, '183.00');
  assert.equal(order.historical_fulfilled_at, null);assert.equal(order.historical_payment_at, null);
  assert.equal(order.analytics_submitted_at.toISOString(), '2018-03-10T00:00:00.000Z');
  assert.equal(order.analytics_snapshot_json.origin, 'legacy');assert.equal(order.analytics_fulfilled_at, null);
  assert.equal(order.analytics_fulfilled_merchandise_net, '150.00');assert.equal(order.analytics_fulfilled_lines_json.length, 2);
  assert.ok(order.analytics_fulfilled_lines_json.every((row: { unitCostCents: unknown }) => row.unitCostCents === null));
  assert.equal(order.refund_history_complete, false);assert.equal(order.merchandise_refund_net, null);
  assert.equal(order.admin_order_notes, 'Original paper record');
  assert.equal(order.contact_name, 'Customer saved with completion');assert.equal(order.organization_name, 'Original company');
  assert.equal(order.notes, 'Original customer message');
  assert.equal(Number(order.pricing_revision), Number(itemResult.pricingRevision) + 1);
  assert.equal((await historical.rejectHistoricalOrderOperation(id))?.status, 409);
  assert.equal((await sendItems({ ...itemBody, expectedHistoricalRevision: order.historical_revision, expectedPricingRevision: order.pricing_revision })).status, 409);
  await client.query("select set_config('atehna.historical_order_write','',true)");
  await rejection("update orders set status='cancelled' where id=$1", [id], /audited historical/);
  await rejection("update orders set recorded_at=now() where id=$1", [id], /provenance is immutable/);
  await rejection("update orders set entry_source='website' where id=$1", [id], /provenance is immutable/);
  await rejection("update orders set is_historical=false where id=$1", [id], /provenance is immutable/);
  await rejection("insert into order_stock_holds(order_id,catalog_variant_id,quantity,state,committed_at,committed_by_actor_type) values($1,$2,1,'held',now(),'admin')", [id, variantId], /cannot change stock/);
  const correction = { expectedHistoricalRevision: order.historical_revision, historicalFulfilledAt: '2018-03-12', historicalPaymentAt: '2018-03-13', historicalRefundNet: '12.00', historicalRefundHistoryComplete: true, historicalNotes: 'Date found in original delivery slip' };
  assert.equal((await historical.handleHistoricalOrderDetails(request(correction), id, correction))?.status, 200);
  const corrected = await readOrder();
  assert.equal(corrected.analytics_fulfilled_at.toISOString(), '2018-03-11T23:00:00.000Z');
  assert.equal(corrected.recorded_at.toISOString(), recorded);
  assert.equal((await historical.handleHistoricalOrderDetails(request(correction), id, correction))?.status, 409);
  const historyBefore = await readHistory();
  assert.equal(historyBefore.length, 3);assert.equal(historyBefore[2].actor_id, 'admin:historical-db-fixture');
  await rejection('delete from order_historical_changes where order_id=$1', [id], /evidence is immutable/);
  await rejection("update order_historical_changes set after_json='{}' where order_id=$1", [id], /evidence is immutable/);
  const correctedHistory = await readHistory();
  const availableNumbers = new Set((await client.query('select order_number from orders')).rows.map(row => Number(String(row.order_number).replace(/\D/g, ''))));
  let nextNumber = 100000;while (availableNumbers.has(nextNumber) || availableNumbers.has(nextNumber + 1)) nextNumber += 2;
  const combined = { expectedHistoricalRevision: corrected.historical_revision, orderNumber: String(nextNumber),
    orderDate: '2018-03-15', originalReferenceSystem: 'Corrected ERP', originalReference: token + '-corrected',
    historicalStatus: 'cancelled', historicalPaymentStatus: 'refunded', historicalShippingGross: '4,50',
    customerType: 'individual', organizationName: '', contactName: 'Corrected customer', email: 'corrected@example.test',
    addressLine1: 'Historical street 2', addressLine2: '', postalCode: '1000', city: 'Ljubljana', countryCode: 'si',
    gursHouseNumberId: null, reference: 'Customer reference', notes: 'Corrected customer message' };
  const combinedResponse = await historical.handleHistoricalOrderDetails(request(combined), id, combined);
  assert.equal(combinedResponse?.status, 200, JSON.stringify(await combinedResponse!.clone().json()));
  const combinedResult = await combinedResponse!.json();
  const combinedOrder = await readOrder();
  assert.equal(combinedOrder.is_draft, false);assert.equal(combinedOrder.order_number, '#' + nextNumber);
  assert.equal(combinedOrder.public_code_base, corrected.public_code_base);assert.equal(combinedOrder.recorded_at.toISOString(), recorded);
  assert.equal(combinedOrder.entry_source, 'manual');assert.equal(combinedOrder.customer_type, 'individual');
  assert.equal(combinedOrder.organization_name, null);assert.equal(combinedOrder.contact_name, 'Corrected customer');
  assert.equal(combinedOrder.address_line1, 'Historical street 2');assert.equal(combinedOrder.address_line2, null);
  assert.equal(combinedOrder.email, 'corrected@example.test');assert.equal(combinedOrder.country_code, 'SI');
  assert.equal(combinedOrder.reference, 'Customer reference');assert.equal(combinedOrder.notes, 'Corrected customer message');
  assert.equal(combinedOrder.shipping, '4.50');assert.equal(combinedOrder.total, '184.50');
  assert.equal(Number(combinedOrder.pricing_revision), Number(corrected.pricing_revision) + 1);
  assert.equal(combinedResult.pricingRevision, Number(combinedOrder.pricing_revision));
  assert.equal(combinedResult.historicalRevision, combinedOrder.historical_revision);
  assert.equal(combinedOrder.status, 'cancelled');assert.equal(combinedOrder.payment_status, 'refunded');
  assert.equal(combinedOrder.created_at.toISOString(), '2018-03-14T23:00:00.000Z');
  assert.equal(combinedOrder.analytics_submitted_at.toISOString(), '2018-03-14T23:00:00.000Z');
  for (const column of ['historical_fulfilled_at', 'historical_payment_at']) assert.equal(combinedOrder[column].toISOString(), corrected[column].toISOString());
  for (const column of ['merchandise_refund_net', 'refund_history_complete', 'admin_order_notes']) assert.equal(combinedOrder[column], corrected[column]);
  const combinedHistory = await readHistory();assert.equal(combinedHistory.length, correctedHistory.length + 1);
  assert.equal(combinedHistory.at(-1).after_json.contact_name, 'Corrected customer');
  assert.equal(combinedHistory.at(-1).before_json.order_number, corrected.order_number);
  assert.equal((await historical.handleHistoricalOrderDetails(request(combined), id, combined))?.status, 409);
  assert.deepEqual(await readOrder(), combinedOrder, 'Stale combined edit must not change any stored field.');
  const sameDate = { expectedHistoricalRevision: combinedOrder.historical_revision, orderDate: '2018-03-15', contactName: 'Same-day edit' };
  assert.equal((await historical.handleHistoricalOrderDetails(request(sameDate), id, sameDate))?.status, 200);
  const sameDateOrder = await readOrder();
  assert.equal(sameDateOrder.created_at.toISOString(), combinedOrder.created_at.toISOString());
  assert.equal(sameDateOrder.pricing_revision, combinedOrder.pricing_revision, 'Unchanged shipping must not advance pricing revision.');
  await client.query(insertOrder, ['#' + (nextNumber + 1), 'Duplicate number fixture', token + '-duplicate']);
  const duplicateNumber = { expectedHistoricalRevision: sameDateOrder.historical_revision, orderNumber: String(nextNumber + 1), contactName: 'Must not persist' };
  const duplicateResponse = await historical.handleHistoricalOrderDetails(request(duplicateNumber), id, duplicateNumber);
  assert.equal(duplicateResponse?.status, 409);assert.equal((await duplicateResponse!.json()).code, 'ORDER_NUMBER_DUPLICATE');
  assert.deepEqual(await readOrder(), sameDateOrder, 'Duplicate number must not partially change the customer.');
  const invalidCustomer = { expectedHistoricalRevision: sameDateOrder.historical_revision, contactName: '' };
  assert.equal((await historical.handleHistoricalOrderDetails(request(invalidCustomer), id, invalidCustomer))?.status, 400);
  failMandatoryHistory = true;
  try {
    const failed = { expectedHistoricalRevision: sameDateOrder.historical_revision, historicalShippingGross: '9.00', contactName: 'Rollback required' };
    await assert.rejects(historical.handleHistoricalOrderDetails(request(failed), id, failed), /Fixture mandatory history failure/);
  } finally { failMandatoryHistory = false; }
  assert.deepEqual(await readOrder(), sameDateOrder, 'Mandatory history failure must roll back the combined UPDATE and analytics trigger.');
  assert.equal((await readHistory()).length, combinedHistory.length + 1);
  await client.query('update orders set deleted_at=now(), archived_at=now() where id=$1', [id]);
  await rejection(insertOrder, ['historical-duplicate-' + token, ' corrected erp ', (token + '-corrected').toUpperCase()], /orders_original_reference_unique/);
  for (const [kind, metadata] of [['order', '{}'], ['media', '{"item_type":"pdf"}']] as const) {
    const event = (await client.query('insert into audit_events(entity_type,entity_id,action,summary,metadata_json) values($1,$2,$3,$4,$5::jsonb) returning id', [kind, String(id), 'updated', 'Historical fixture', metadata])).rows[0].id;
    await rejection('delete from audit_events where id=$1', [event], /cannot be deleted/);
  }
  const unrelated = (await client.query("insert into audit_events(entity_type,entity_id,action,summary) values('media',$1,'updated','Unrelated fixture') returning id", [token])).rows[0].id;
  assert.equal((await client.query('delete from audit_events where id=$1', [unrelated])).rowCount, 1);
  const archive = (await client.query("insert into deleted_archive_entries(item_type,order_id,label) values('order',$1,'Historical fixture') returning expires_at", [id])).rows[0];
  assert.equal(archive.expires_at, null);
  for (const table of ['order_stock_holds', 'order_email_jobs', 'order_documents', 'order_status_logs', 'order_payment_logs']) {
    const result = await client.query('select count(*)::int as count from ' + table + ' where order_id=$1', [id]);
    assert.equal(result.rows[0].count, 0, table + ' must remain untouched by historical entry.');
  }
  assert.equal((await client.query('select inventory from catalog_item_variants where id=$1', [variantId])).rows[0].inventory, 10);
  assert.ok(!queries.some(sql => /update catalog_item_variants|insert into order_email_jobs|insert into order_documents/i.test(sql)));
  await client.query('rollback');
  console.info('PASS historical PostgreSQL workflow: atomic finalized customer/source/date/status/payment/shipping changes; duplicate number and mandatory audit rollback; unchanged hidden evidence and public code; manual and linked original items; original VAT; both CAS tokens; explicit completion; original analytics date; unknown fulfilment/cost/refund facts; audited corrections and notes; immutable provenance/history; duplicate protection through trash/archive; no stock/email/new-document effects. All fixtures rolled back.');
} finally {
  await client.query('rollback').catch(() => undefined);
  client.release();await pool.end();
}

